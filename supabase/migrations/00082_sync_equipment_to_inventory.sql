-- Migration 00082: Synchronisation equipement <-> fiches d'inventaire
-- =============================================================================
-- REGLE APPLICATIVE : LE MATERIEL (equipment) A AUSSI SA FICHE D'INVENTAIRE.
--   - Même philosophie que 00081 (produits) : chaque materiel de equipment doit
--     avoir sa fiche dans inventory, rattachee par inventory.equipment_id.
--   - quantity = stock_initial = equipment.quantity (calcule == actuel, regle 00078).
--   - price = equipment.purchase_price.
--   - Anti-conflit nom produit / materiel : la recherche de fiche par nom n'est
--     faite QUE si la fiche n'est liee ni a un produit ni a un autre materiel
--     (product_id IS NULL AND equipment_id IS NULL). Le trigger produit (00081)
--     est recree avec la meme garde pour ne jamais ecraser une fiche materiel.
--   - Trigger sync_equipment_to_inventory() : chaque NOUVEAU materiel cree via
--     l'UI obtient sa fiche automatiquement (idempotent, SECURITY DEFINER).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. inventory.equipment_id : lien fiche d'inventaire <-> materiel
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES equipment(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_equipment_id ON inventory (equipment_id);

-- ---------------------------------------------------------------------------
-- 2. Backfill : cree la fiche d'inventaire manquante pour chaque materiel.
--    Fiche recherchee par equipment_id ; sinon par nom + organisation UNIQUEMENT
--    si la fiche n'est liee ni a un produit ni a un materiel (evite les
--    collisions de nom produit/materiel).
-- ---------------------------------------------------------------------------
INSERT INTO inventory (organization_id, name, category, unit, quantity, stock_initial, min_stock, price, equipment_id)
SELECT
  e.organization_id,
  e.name,
  COALESCE(e.category, 'equipment'),
  'piece',
  COALESCE(e.quantity, 1),
  COALESCE(e.quantity, 1),
  0,
  COALESCE(e.purchase_price, 0),
  e.id
FROM equipment e
WHERE NOT EXISTS (
  SELECT 1 FROM inventory i WHERE i.equipment_id = e.id
)
AND NOT EXISTS (
  SELECT 1 FROM inventory i
  WHERE i.organization_id = e.organization_id
    AND lower(i.name) = lower(e.name)
    AND i.product_id IS NULL
    AND i.equipment_id IS NULL
);

-- ---------------------------------------------------------------------------
-- 3. Trigger : chaque NOUVEAU materiel obtient sa fiche d'inventaire
--    - Idempotent : fiche deja liee par equipment_id -> rien ne duplique.
--    - Recherche par nom uniquement si la fiche est libre (ni produit ni materiel).
--    - Ne cree QUE la fiche : aucun mouvement stock_movements.
--    - SECURITY DEFINER : ecrit dans inventory en tant que systeme, sans RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_equipment_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
BEGIN
  -- Fiche existante liee a ce materiel ?
  SELECT id INTO v_inv_id FROM inventory WHERE equipment_id = NEW.id LIMIT 1;
  IF v_inv_id IS NULL THEN
    -- Sinon fiche libre par nom + meme organisation (ni produit, ni materiel)
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = NEW.organization_id
      AND lower(name) = lower(NEW.name)
      AND product_id IS NULL
      AND equipment_id IS NULL
    LIMIT 1;
  END IF;

  IF v_inv_id IS NULL THEN
    -- Aucune fiche : en créer une cohérente (quantity = stock_initial = quantity materiel)
    INSERT INTO inventory (organization_id, name, category, unit, quantity, stock_initial, min_stock, price, equipment_id)
    VALUES (NEW.organization_id, NEW.name, COALESCE(NEW.category, 'equipment'), 'piece',
            COALESCE(NEW.quantity, 1), COALESCE(NEW.quantity, 1), 0,
            COALESCE(NEW.purchase_price, 0), NEW.id);
  ELSE
    -- Fiche trouvee : rattacher au materiel
    UPDATE inventory
    SET equipment_id = NEW.id,
        price = COALESCE(NEW.purchase_price, price),
        category = COALESCE(NEW.category, category)
    WHERE id = v_inv_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipment_to_inventory ON equipment;
CREATE TRIGGER trg_equipment_to_inventory
AFTER INSERT ON equipment
FOR EACH ROW
EXECUTE FUNCTION public.sync_equipment_to_inventory();

-- ---------------------------------------------------------------------------
-- 4. Recree le trigger produit (00081) avec une garde anti-conflit :
--    la recherche de fiche par nom exclut les fiches liees a un materiel
--    (equipment_id IS NOT NULL) pour ne jamais ecraser une fiche materiel.
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
  -- Fiche existante liee a ce produit ?
  SELECT id INTO v_inv_id FROM inventory WHERE product_id = NEW.id LIMIT 1;
  IF v_inv_id IS NULL THEN
    -- Sinon fiche libre par nom + meme organisation (ni produit, ni materiel)
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = NEW.organization_id
      AND lower(name) = lower(NEW.name)
      AND product_id IS NULL
      AND equipment_id IS NULL
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
-- 5. RLS / GRANT : rien a ajouter (policies existantes, fonctions SECURITY DEFINER).
-- ---------------------------------------------------------------------------
