-- Migration 00081: Synchronisation produits <-> fiches d'inventaire (1 produit = 1 fiche)
-- =============================================================================
-- REGLE APPLICATIVE : UN PRODUIT = UNE FICHE D'INVENTAIRE.
--   - Chaque produit de products doit avoir sa fiche dans inventory, rattachee
--     par inventory.product_id.
--   - Un produit cree via l'UI (products.tsx) n'inserait aucune fiche inventaire :
--     seuls record_product_stock_add/out (00079) et receive_purchase_order (00080)
--     creaient la fiche. La migration 00079 n'avait fait que LIER les fiches
--     existantes par nom ; les produits sans fiche restaient sans fiche.
--   - Backfill ci-dessous : cree la fiche manquante pour chaque produit actif,
--     coherente immediatement avec la regle 00078
--     (quantity = stock_initial = stock produit actuel, donc calcule == actuel).
--   - Mouvements orphelins : un stock_movements dont product_id est renseigne
--     mais dont la fiche (inventory_id) est une fiche NON liee (doublon potentiel)
--     est re-poincte vers la fiche officielle du produit pour conserver
--     l'historique et la coherence (00078). Les mouvements POS legitimes (fiche
--     deja liee a un produit) ne sont jamais deplaces.
--   - Le trigger sync_product_to_inventory() garantit la regle pour les FUTURS
--     produits : idempotent (fiche existante par product_id -> rien ne duplique),
--     il ne cree QUE la fiche (jamais de mouvement stock_movements), et il est
--     SECURITY DEFINER car il ecrit dans inventory en tant que systeme, sans RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Garantie de colonne : image_url peut manquer sur certains environnements
--    (migration 00029 non executee). Idempotent, sans effet si deja presente.
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ---------------------------------------------------------------------------
-- 1. Backfill : cree la fiche d'inventaire manquante pour chaque produit actif
--    Aucune fiche existante (ni par product_id, ni par nom + organisation) :
--    on insere une fiche coherente avec 00078.
--    unit = 'piece', price = products.cost sinon products.price,
--    quantity = stock_initial = stock produit (calcule == actuel des la creation).
-- ---------------------------------------------------------------------------
INSERT INTO inventory (organization_id, name, category, unit, quantity, stock_initial, min_stock, price, image_url, product_id)
SELECT
  p.organization_id,
  p.name,
  p.category,
  'piece',
  COALESCE(p.stock, 0),
  COALESCE(p.stock, 0),
  0,
  COALESCE(p.cost, p.price, 0),
  p.image_url,
  p.id
FROM products p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM inventory i WHERE i.product_id = p.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM inventory i
    WHERE i.organization_id = p.organization_id
      AND lower(i.name) = lower(p.name)
  );

-- ---------------------------------------------------------------------------
-- 2. Mouvements orphelins : re-poincte vers la fiche liee au produit
--    Pour chaque mouvement sm dont le produit est connu (product_id non nul) et
--    pour lequel une fiche inv est liee a ce produit (inv.product_id = sm.product_id)
--    mais que le mouvement pointe vers une AUTRE fiche (sm.inventory_id <> inv.id)
--    qui est elle-meme NON liee (ancienne fiche sans product_id = doublon potentiel),
--    on rattache le mouvement a la fiche officielle du produit.
--    Garde POS : un mouvement 'vente' (reference_type='pos_transaction') dont la
--    fiche inventory_id est deja liee a un produit n'est JAMAIS deplace.
--    En cas de plusieurs fiches liees au meme produit (anomalie historique), on
--    retient la plus ancienne (DISTINCT ON + ORDER BY inv.created_at).
-- ---------------------------------------------------------------------------
UPDATE stock_movements sm
SET inventory_id = sub.inv_id
FROM (
  SELECT DISTINCT ON (sm2.id) sm2.id AS sm_id, inv.id AS inv_id
  FROM stock_movements sm2
  JOIN inventory inv ON inv.product_id = sm2.product_id
  WHERE sm2.product_id IS NOT NULL
    AND sm2.inventory_id <> inv.id
    AND NOT EXISTS (
      SELECT 1 FROM inventory old_inv
      WHERE old_inv.id = sm2.inventory_id
        AND old_inv.product_id IS NOT NULL
    )
    AND NOT (
      sm2.reason = 'vente'
      AND sm2.reference_type = 'pos_transaction'
      AND EXISTS (
        SELECT 1 FROM inventory old_inv
        WHERE old_inv.id = sm2.inventory_id
          AND old_inv.product_id IS NOT NULL
      )
    )
  ORDER BY sm2.id, inv.created_at
) sub
WHERE sm.id = sub.sm_id;

-- ---------------------------------------------------------------------------
-- 3. Trigger : chaque NOUVEAU produit obtient sa fiche d'inventaire
--    - Idempotent : fiche deja liee par product_id -> rien ne duplique ;
--      sinon fiche liee par nom + meme organisation (lien historique 00079).
--    - Ne cree QUE la fiche : aucun mouvement stock_movements.
--    - Fiche coherente 00078 : quantity = stock_initial = stock produit.
--    - SECURITY DEFINER : ecrit dans inventory en tant que systeme, sans RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_product_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
BEGIN
  -- Fiche existante liée à ce produit ?
  SELECT id INTO v_inv_id FROM inventory WHERE product_id = NEW.id LIMIT 1;
  IF v_inv_id IS NULL THEN
    -- Sinon fiche existante par nom + même organisation (lien historique 00079)
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = NEW.organization_id AND lower(name) = lower(NEW.name)
    LIMIT 1;
  END IF;

  IF v_inv_id IS NULL THEN
    -- Aucune fiche : en créer une cohérente (quantity = stock_initial = stock produit)
    INSERT INTO inventory (organization_id, name, category, unit, quantity, stock_initial, min_stock, price, image_url, product_id)
    VALUES (NEW.organization_id, NEW.name, NEW.category, 'piece',
            COALESCE(NEW.stock, 0), COALESCE(NEW.stock, 0), 0,
            COALESCE(NEW.cost, NEW.price, 0), NEW.image_url, NEW.id);
  ELSE
    -- Fiche trouvée : rattacher au produit (et réutiliser son prix si le produit n'a pas de cost)
    UPDATE inventory
    SET product_id = NEW.id,
        price = COALESCE(NEW.cost, NEW.price, price),
        category = COALESCE(NEW.category, category)
    WHERE id = v_inv_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_to_inventory ON products;
CREATE TRIGGER trg_product_to_inventory
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_to_inventory();

-- ---------------------------------------------------------------------------
-- 4. RLS / GRANT : rien a ajouter.
--    inventory possede deja ses policies (migration 00001) et les fonctions
--    SECURITY DEFINER contournent la RLS.
-- ---------------------------------------------------------------------------
