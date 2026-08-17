-- =============================================================================
-- 00099 : Fix prix stock/inventaire/consommables
--
-- Bug : quand on ajoute du stock avec un nouveau prix unitaire via le volet
-- "Rajouter du stock" (produits.tsx → record_product_stock_add), le prix
-- dans inventory.price ET products.cost n'est PAS mis à jour.
--
-- Corrections :
--   1. record_product_stock_add  → UPDATE inventory.price + products.cost
--   2. receive_purchase_order    → UPDATE inventory.price + products.cost
--   3. record_stock_movement     → UPDATE consumables.cost (manquait)
-- =============================================================================

-- 1. record_product_stock_add : ajouter UPDATE price sur inventory + products
CREATE OR REPLACE FUNCTION public.record_product_stock_add(
  p_product_id uuid,
  p_quantity int,
  p_unit_price numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_movement_date date DEFAULT CURRENT_DATE,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_is_admin boolean;
  v_inv_id uuid;
  v_cur int;
  v_stock int;
  v_product public.products%ROWTYPE;
BEGIN
  IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Missing or invalid parameters';
  END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  v_org := v_product.organization_id;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = v_org
      AND ur.role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT id INTO v_inv_id
  FROM inventory
  WHERE organization_id = v_org AND product_id = p_product_id
  LIMIT 1;
  IF v_inv_id IS NULL THEN
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = v_org AND lower(name) = lower(v_product.name)
    LIMIT 1;
  END IF;

  IF v_inv_id IS NULL THEN
    INSERT INTO inventory (organization_id, name, category, unit, price, supplier_id, quantity, stock_initial, product_id)
    VALUES (v_org, v_product.name, v_product.category, 'piece',
            COALESCE(p_unit_price, v_product.cost, 0), p_supplier_id,
            COALESCE(v_product.stock, 0), COALESCE(v_product.stock, 0), p_product_id)
    RETURNING id INTO v_inv_id;
  ELSE
    UPDATE inventory SET product_id = p_product_id WHERE id = v_inv_id;
    -- FIX : mettre à jour le prix/fournisseur de la fiche d'inventaire
    IF p_unit_price IS NOT NULL OR p_supplier_id IS NOT NULL THEN
      UPDATE inventory
      SET price = COALESCE(p_unit_price, price),
          supplier_id = COALESCE(p_supplier_id, supplier_id)
      WHERE id = v_inv_id;
    END IF;
  END IF;

  SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
  v_cur := v_cur + p_quantity;
  UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

  v_stock := COALESCE(v_product.stock, 0) + p_quantity;
  UPDATE products SET stock = v_stock WHERE id = p_product_id;

  -- FIX : mettre à jour le coût unitaire du produit
  IF p_unit_price IS NOT NULL THEN
    UPDATE products SET cost = p_unit_price WHERE id = p_product_id;
  END IF;

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, unit_price, supplier_id, reference, movement_date, notes, reason)
  VALUES (v_inv_id, p_product_id, v_org, 'in', p_quantity, p_unit_price, p_supplier_id, p_reference, p_movement_date, p_notes, 'achat');

  RETURN jsonb_build_object(
    'success', true,
    'product_id', p_product_id,
    'inventory_id', v_inv_id,
    'quantity', v_cur,
    'product_stock', v_stock,
    'expected_stock', public.product_expected_stock(p_product_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_product_stock_add(uuid, int, numeric, uuid, text, date, text) TO authenticated;

-- 2. receive_purchase_order : ajouter UPDATE price sur inventory + products
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_is_admin boolean;
  v_po public.purchase_orders%ROWTYPE;
  v_line RECORD;
  v_inv_id uuid;
  v_cur int;
  v_stock int;
  v_created int := 0;
  v_skipped int := 0;
BEGIN
  SELECT * INTO v_po FROM purchase_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bon de commande introuvable';
  END IF;
  v_org := v_po.organization_id;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = v_org
      AND ur.role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF v_po.status = 'received' THEN
    RETURN jsonb_build_object('success', true, 'created', 0, 'already_received', true);
  END IF;

  FOR v_line IN
    SELECT poi.product_id, poi.quantity, poi.unit_price, p.name AS product_name
    FROM purchase_order_items poi
    JOIN products p ON p.id = poi.product_id
    WHERE poi.purchase_order_id = p_order_id
  LOOP
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = v_org AND product_id = v_line.product_id
    LIMIT 1;
    IF v_inv_id IS NULL THEN
      SELECT id INTO v_inv_id
      FROM inventory
      WHERE organization_id = v_org AND lower(name) = lower(v_line.product_name)
      LIMIT 1;
    END IF;

    SELECT stock INTO v_stock
    FROM products
    WHERE id = v_line.product_id
    FOR UPDATE;
    v_stock := COALESCE(v_stock, 0);

    IF v_inv_id IS NULL THEN
      INSERT INTO inventory (organization_id, name, category, unit, price, supplier_id, quantity, stock_initial, product_id)
      VALUES (v_org, v_line.product_name, 'products', 'piece',
              COALESCE(v_line.unit_price, 0), v_po.supplier_id,
              v_stock, v_stock, v_line.product_id)
      RETURNING id INTO v_inv_id;
    ELSE
      UPDATE inventory SET product_id = v_line.product_id WHERE id = v_inv_id;
      -- FIX : mettre à jour le prix/fournisseur de la fiche d'inventaire
      IF v_line.unit_price IS NOT NULL OR v_po.supplier_id IS NOT NULL THEN
        UPDATE inventory
        SET price = COALESCE(v_line.unit_price, price),
            supplier_id = COALESCE(v_po.supplier_id, supplier_id)
        WHERE id = v_inv_id;
      END IF;
    END IF;

    SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
    v_cur := v_cur + v_line.quantity;
    UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

    v_stock := v_stock + v_line.quantity;
    UPDATE products SET stock = v_stock WHERE id = v_line.product_id;

    -- FIX : mettre à jour le coût unitaire du produit
    IF v_line.unit_price IS NOT NULL THEN
      UPDATE products SET cost = v_line.unit_price WHERE id = v_line.product_id;
    END IF;

    INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, unit_price, supplier_id, movement_date, notes, reason, reference_type, reference_id)
    VALUES (v_inv_id, v_line.product_id, v_org, 'in', v_line.quantity, v_line.unit_price, v_po.supplier_id,
            CURRENT_DATE, 'Réception BC - ' || v_line.product_name, 'reception', 'purchase_order', p_order_id);

    v_created := v_created + 1;
  END LOOP;

  SELECT COUNT(*) INTO v_skipped
  FROM purchase_order_items poi
  LEFT JOIN products p ON p.id = poi.product_id
  WHERE poi.purchase_order_id = p_order_id AND p.id IS NULL;

  UPDATE purchase_orders SET status = 'received' WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_order_id', p_order_id,
    'created', v_created,
    'skipped', v_skipped,
    'already_received', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;

-- 3. record_stock_movement : ajouter UPDATE consumables.cost sur stock-in
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_organization_id uuid,
  p_inventory_id uuid,
  p_type text,
  p_quantity int,
  p_notes text DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_movement_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.inventory%ROWTYPE;
  v_cur int;
  v_new int;
  v_prod uuid;
  v_prod_stock int;
  v_consumable uuid;
  v_consumable_stock int;
  v_mv_id uuid;
  v_expected int;
  v_is_admin boolean;
BEGIN
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Invalid movement type: must be ''in'' or ''out''';
  END IF;
  IF p_quantity <= 0 THEN
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

  v_prod := v_row.product_id;
  IF v_prod IS NOT NULL THEN
    SELECT stock INTO v_prod_stock FROM products WHERE id = v_prod FOR UPDATE;
    IF p_type = 'out' AND COALESCE(v_prod_stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient product stock: % < %', COALESCE(v_prod_stock, 0), p_quantity;
    END IF;
  END IF;

  v_consumable := v_row.consumable_id;
  IF v_consumable IS NOT NULL THEN
    SELECT quantity INTO v_consumable_stock FROM consumables WHERE id = v_consumable FOR UPDATE;
    IF p_type = 'out' AND COALESCE(v_consumable_stock, 0) < p_quantity THEN
      RAISE EXCEPTION 'Insufficient consumable stock: % < %', COALESCE(v_consumable_stock, 0), p_quantity;
    END IF;
  END IF;

  v_new := v_cur + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;

  UPDATE inventory SET quantity = v_new WHERE id = p_inventory_id;

  IF p_type = 'in' AND (p_unit_price IS NOT NULL OR p_supplier_id IS NOT NULL) THEN
    UPDATE inventory
    SET price = COALESCE(p_unit_price, price),
        supplier_id = COALESCE(p_supplier_id, supplier_id)
    WHERE id = p_inventory_id;
  END IF;

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, notes, reason, reference_type, reference_id, unit_price, supplier_id, reference, movement_date)
  VALUES (p_inventory_id, v_prod, p_organization_id, p_type, p_quantity, p_notes, p_reason, p_reference_type, p_reference_id, p_unit_price, p_supplier_id, p_reference, COALESCE(p_movement_date, CURRENT_DATE))
  RETURNING id INTO v_mv_id;

  IF v_prod IS NOT NULL THEN
    v_prod_stock := COALESCE(v_prod_stock, 0) + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;
    UPDATE products SET stock = v_prod_stock WHERE id = v_prod;
    -- FIX : mettre à jour le coût unitaire du produit sur entrée
    IF p_type = 'in' AND p_unit_price IS NOT NULL THEN
      UPDATE products SET cost = p_unit_price WHERE id = v_prod;
    END IF;
  END IF;

  IF v_consumable IS NOT NULL THEN
    v_consumable_stock := COALESCE(v_consumable_stock, 0) + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;
    UPDATE consumables SET quantity = v_consumable_stock WHERE id = v_consumable;
    -- FIX : mettre à jour le coût unitaire du consommable sur entrée
    IF p_type = 'in' AND p_unit_price IS NOT NULL THEN
      UPDATE consumables SET cost = p_unit_price WHERE id = v_consumable;
    END IF;
  END IF;

  v_expected := public.inventory_expected_stock(p_inventory_id);

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'product_id', v_prod,
    'consumable_id', v_consumable,
    'movement_id', v_mv_id,
    'quantity', v_new,
    'expected', v_expected
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, int, text, text, text, uuid, numeric, uuid, text, date) TO authenticated;
