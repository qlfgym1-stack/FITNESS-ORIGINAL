-- Migration 00080: Lignes de bon de commande + réception (workflow achat complet)
-- =============================================================================
--   1. purchase_order_items : lignes d'un BC (produit, qté, prix unitaire, sous-total)
--   2. RPC create_purchase_order  : crée le BC + ses lignes en une transaction,
--      total_amount calculé (jamais saisi à la main)
--   3. RPC receive_purchase_order : réceptionne un BC -- pour chaque ligne,
--      incrémente inventory.quantity + products.stock et journalise une entrée
--      stock_movements 'in' (reason='reception', référence vers le BC).
--      Le trigger existant (00073) crée la dépense unique "Achat - Fournisseur"
--      au passage du statut en 'received' (pas de dépense par ligne : reason
--      'reception' n'est pas 'achat', donc sync_stock_movement_to_expense ignore).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table purchase_order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items (product_id);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage purchase_order_items" ON purchase_order_items;
CREATE POLICY "Admins can manage purchase_order_items" ON purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    )
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN purchase_orders po ON po.organization_id = ur.organization_id
        WHERE ur.user_id = auth.uid()
          AND po.id = purchase_order_items.purchase_order_id
          AND ur.role = 'admin'
      )
  );

DROP POLICY IF EXISTS "Staff can view purchase_order_items" ON purchase_order_items;
CREATE POLICY "Staff can view purchase_order_items" ON purchase_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 2. RPC create_purchase_order
--    p_items : jsonb de [{ product_id, quantity, unit_price }]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_supplier_id uuid,
  p_order_date date,
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_is_admin boolean;
  v_po_id uuid;
  v_item jsonb;
  v_prod uuid;
  v_qty int;
  v_price numeric;
  v_total numeric := 0;
  v_count int := 0;
BEGIN
  -- Validation des entrées
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Aucun article dans le bon de commande';
  END IF;

  SELECT organization_id INTO v_org FROM suppliers WHERE id = p_supplier_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Fournisseur introuvable';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = v_org
      AND ur.role = 'admin'
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  -- Calcul du total + vérification des produits (même organisation)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);

    IF v_prod IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Article invalide (produit ou quantité)';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = v_prod AND p.organization_id = v_org
    ) THEN
      RAISE EXCEPTION 'Produit % hors de l''organisation', v_prod;
    END IF;

    v_total := v_total + (v_price * v_qty);
    v_count := v_count + 1;
  END LOOP;

  -- Création du BC
  INSERT INTO purchase_orders (organization_id, supplier_id, order_date, status, total_amount, notes)
  VALUES (v_org, p_supplier_id, COALESCE(p_order_date, CURRENT_DATE), 'pending', v_total, p_notes)
  RETURNING id INTO v_po_id;

  -- Création des lignes
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);

    INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_po_id, v_prod, v_qty, v_price, v_price * v_qty);
  END LOOP;

  RETURN v_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, date, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. RPC receive_purchase_order
--    Réceptionne le BC : pour chaque ligne, augmente inventory.quantity et
--    products.stock, journalise un mouvement 'in' (reason='reception') référencé
--    vers le BC, puis passe le statut en 'received' (déclenche la dépense 00073).
-- ---------------------------------------------------------------------------
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

  -- Réception de chaque ligne
  FOR v_line IN
    SELECT poi.product_id, poi.quantity, poi.unit_price, p.name AS product_name, p.stock AS product_stock
    FROM purchase_order_items poi
    JOIN products p ON p.id = poi.product_id
    WHERE poi.purchase_order_id = p_order_id
  LOOP
    -- Fiche d'inventaire liée (par product_id, sinon par nom + org)
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

    IF v_inv_id IS NULL THEN
      INSERT INTO inventory (organization_id, name, category, unit, price, supplier_id, quantity, stock_initial, product_id)
      VALUES (v_org, v_line.product_name, 'products', 'piece',
              COALESCE(v_line.unit_price, 0), v_po.supplier_id,
              COALESCE(v_line.product_stock, 0), COALESCE(v_line.product_stock, 0), v_line.product_id)
      RETURNING id INTO v_inv_id;
    ELSE
      UPDATE inventory SET product_id = v_line.product_id WHERE id = v_inv_id;
    END IF;

    -- Incrément atomique de l'inventaire
    SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
    v_cur := v_cur + v_line.quantity;
    UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

    -- products.stock = stock calculé
    v_stock := COALESCE(v_line.product_stock, 0) + v_line.quantity;
    UPDATE products SET stock = v_stock WHERE id = v_line.product_id;

    INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, unit_price, supplier_id, movement_date, notes, reason, reference_type, reference_id)
    VALUES (v_inv_id, v_line.product_id, v_org, 'in', v_line.quantity, v_line.unit_price, v_po.supplier_id,
            CURRENT_DATE, 'Réception BC - ' || v_line.product_name, 'reception', 'purchase_order', p_order_id);

    v_created := v_created + 1;
  END LOOP;

  -- Passage en 'received' -> le trigger 00073 crée la dépense unique
  UPDATE purchase_orders SET status = 'received' WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_order_id', p_order_id,
    'created', v_created,
    'already_received', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid) TO authenticated;
