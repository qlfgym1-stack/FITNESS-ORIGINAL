-- Migration 00083: Corrections de synchronisation stock produits <-> fiches inventaire
-- =============================================================================
-- Contexte (audit) : 4 désynchronisations silencieuses entre products.stock,
-- inventory.quantity et stock_movements :
--   1. record_stock_movement (00078) : les ajustements manuels de la page
--      "Mouvements de stock" ne touchaient PAS products.stock et inséraient le
--      mouvement SANS product_id -> quand la fiche est liee a un produit,
--      products.stock restait fige alors que l'inventaire bougeait.
--   2. products.tsx (edition) : le champ "stock" ecrivait products.stock
--      directement, sans mouvement ni fiche -> hors ledger (corrige cote
--      frontend : stock non modifiable a l'edition, variations via
--      record_product_stock_add/out).
--   3. equipment/materiel : le trigger 00082 ne tournait que sur INSERT.
--      Modifier la quantite d'un materiel ne synchronisait pas la fiche liee.
--   4. Suppression produit/materiel : la fiche restait orpheline (SET NULL).
--      Desormais supprimee uniquement si elle n'a AUCUN mouvement (l'historique
--      n'est jamais perdu).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. record_stock_movement : synchronise products.stock + journalise product_id
--    Meme signature (8 params) -> le GRANT 00078 reste valide.
--    - Si la fiche est liee a un produit (inventory.product_id), l'ajustement
--      met AUSSI a jour products.stock du meme delta et renseigne product_id
--      sur le mouvement (product_expected_stock reste coherent).
--    - Garde sortie : jamais negatif (inventaire + produit).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_organization_id uuid,
  p_inventory_id uuid,
  p_type text,
  p_quantity int,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_row public.inventory%ROWTYPE;
  v_cur int;
  v_new int;
  v_expected int;
  v_prod uuid;
  v_prod_stock int;
  v_mv_id uuid;
BEGIN
  IF p_organization_id IS NULL OR p_inventory_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameters';
  END IF;
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid type: %', p_type;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_organization_id
      AND ur.role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Verrouille la fiche (ligne complete : product_id inclus)
  SELECT * INTO v_row
  FROM inventory
  WHERE id = p_inventory_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found in organization';
  END IF;
  v_cur := v_row.quantity;

  IF p_type = 'out' AND v_cur < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % < %', v_cur, p_quantity;
  END IF;

  -- Produit lie : verrouiller et verifier la garde de sortie
  v_prod := v_row.product_id;
  IF v_prod IS NOT NULL THEN
    SELECT stock INTO v_prod_stock FROM products WHERE id = v_prod FOR UPDATE;
    IF p_type = 'out' AND COALESCE(v_prod_stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient product stock: % < %', COALESCE(v_prod_stock, 0), p_quantity;
    END IF;
  END IF;

  v_new := v_cur + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;

  UPDATE inventory SET quantity = v_new WHERE id = p_inventory_id;

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, notes, reason, reference_type, reference_id, movement_date)
  VALUES (p_inventory_id, v_prod, p_organization_id, p_type, p_quantity, p_notes, p_reason, p_reference_type, p_reference_id, CURRENT_DATE)
  RETURNING id INTO v_mv_id;

  -- Synchronisation products.stock (regle 00079 : stock calcule)
  IF v_prod IS NOT NULL THEN
    v_prod_stock := COALESCE(v_prod_stock, 0) + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;
    UPDATE products SET stock = v_prod_stock WHERE id = v_prod;
  END IF;

  v_expected := public.inventory_expected_stock(p_inventory_id);

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'product_id', v_prod,
    'movement_id', v_mv_id,
    'quantity', v_new,
    'consistent', (v_expected = v_new)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger : modification de la quantite d'un materiel -> synchronise la fiche
--    liee (equipment_id). stock_initial ajuste du meme delta pour conserver la
--    regle 00078 (calcule == actuel) sans recalcul des mouvements.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_equipment_quantity_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
  v_delta int;
BEGIN
  IF NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    SELECT id INTO v_inv_id FROM inventory WHERE equipment_id = NEW.id LIMIT 1;
    IF v_inv_id IS NOT NULL THEN
      v_delta := COALESCE(NEW.quantity, 0) - COALESCE(OLD.quantity, 0);
      UPDATE inventory
      SET quantity = COALESCE(NEW.quantity, 0),
          stock_initial = GREATEST(0, COALESCE(stock_initial, 0) + v_delta)
      WHERE id = v_inv_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipment_quantity_to_inventory ON equipment;
CREATE TRIGGER trg_equipment_quantity_to_inventory
AFTER UPDATE OF quantity ON equipment
FOR EACH ROW
EXECUTE FUNCTION public.sync_equipment_quantity_to_inventory();

-- ---------------------------------------------------------------------------
-- 3. Triggers BEFORE DELETE : supprime la fiche dediee d'un produit/materiel
--    UNIQUEMENT si elle n'a aucun mouvement (pas de perte d'historique).
--    BEFORE : capte product_id/equipment_id avant le SET NULL de la FK.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_product_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
  v_cnt int;
BEGIN
  SELECT id INTO v_inv_id FROM inventory WHERE product_id = OLD.id LIMIT 1;
  IF v_inv_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_cnt FROM stock_movements WHERE inventory_id = v_inv_id;
    IF v_cnt = 0 THEN
      DELETE FROM inventory WHERE id = v_inv_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_inventory_product ON products;
CREATE TRIGGER trg_cleanup_inventory_product
BEFORE DELETE ON products
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_inventory_on_product_delete();

CREATE OR REPLACE FUNCTION public.cleanup_inventory_on_equipment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
  v_cnt int;
BEGIN
  SELECT id INTO v_inv_id FROM inventory WHERE equipment_id = OLD.id LIMIT 1;
  IF v_inv_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_cnt FROM stock_movements WHERE inventory_id = v_inv_id;
    IF v_cnt = 0 THEN
      DELETE FROM inventory WHERE id = v_inv_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_inventory_equipment ON equipment;
CREATE TRIGGER trg_cleanup_inventory_equipment
BEFORE DELETE ON equipment
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_inventory_on_equipment_delete();
