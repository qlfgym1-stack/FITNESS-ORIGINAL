-- Migration 00084: Correctifs bugs — transactionnalité POS + workflow stock/achats
-- =============================================================================
--   S1  : record_pos_checkout — vente POS 100% transactionnelle (décrément stock +
--         session + transaction + mouvements en une seule unité atomique).
--   S3  : receive_purchase_order — relecture de products.stock verrouillée par
--         ligne (FOR UPDATE) : 2 lignes d'un même produit sur le BC ne s'écrasent plus.
--   S5  : stock_movements.inventory_id — ON DELETE RESTRICT : la suppression d'une
--         fiche d'inventaire ne peut plus détruire l'historique des mouvements.
--   S8  : sync_stock_movement_to_expense — la dépense "Achat stock" reprend
--         NEW.movement_date au lieu de CURRENT_DATE (saisies rétroactives).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- S1. record_pos_checkout : une seule transaction pour toute la vente.
--  1. Vérifie que le caller est admin/receptionist de l'org
--  2. Décrémente products.stock pour chaque article physique (garde atomique
--     WHERE stock >= qty) — tout échec annule la vente entière
--  3. Insère pos_sessions + pos_transactions
--  4. Journalise les mouvements stock via record_pos_sale_stock (même transaction)
--  Retourne { success, transaction_id, session_id }
--  Les articles virtuels (__subscription__, __renewal__, __dropin__) sont ignorés.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_pos_checkout(
  p_organization_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_payment_method text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_prod_id text;
  v_prod_uuid uuid;
  v_qty int;
  v_session_id uuid;
  v_tx_id uuid;
BEGIN
  IF NOT public.is_encaissement_operator(p_organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;

  -- 1. Décrément atomique du stock produits (tout ou rien)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_prod_id := v_item->>'id';
    v_prod_uuid := NULL;
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_prod_id IS NULL OR v_prod_id LIKE '\_\_%' THEN
      CONTINUE;
    END IF;
    BEGIN
      v_prod_uuid := v_prod_id::uuid;
    EXCEPTION WHEN others THEN
      v_prod_uuid := NULL;
    END;
    IF v_prod_uuid IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE products
    SET stock = stock - v_qty
    WHERE id = v_prod_uuid AND stock >= v_qty;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock insuffisant pour %', v_item->>'name';
    END IF;
  END LOOP;

  -- 2. Session + transaction
  INSERT INTO pos_sessions (organization_id, status, opened_at, total)
  VALUES (p_organization_id, 'open', now(), p_total)
  RETURNING id INTO v_session_id;

  INSERT INTO pos_transactions (
    session_id, organization_id, member_id, items, subtotal,
    discount, total, payment_method, payment_status, created_by
  )
  VALUES (
    v_session_id, p_organization_id, p_member_id, p_items, p_subtotal,
    p_discount, p_total, p_payment_method, 'completed', p_user_id
  )
  RETURNING id INTO v_tx_id;

  -- 3. Mouvements de stock (même transaction : un échec annule tout)
  PERFORM public.record_pos_sale_stock(v_tx_id);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'session_id', v_session_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_checkout(uuid, uuid, jsonb, numeric, numeric, numeric, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- S3. receive_purchase_order : fix multi-lignes même produit.
--  Le snapshot initial `p.stock AS product_stock` écrasait le stock si 2 lignes
--  référençaient le même produit. On relit désormais products.stock avec
--  FOR UPDATE à chaque ligne, et on compte les lignes ignorées (produit supprimé).
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

  -- Réception de chaque ligne
  FOR v_line IN
    SELECT poi.product_id, poi.quantity, poi.unit_price, p.name AS product_name
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

    -- Stock produit relu avec verrouillage : jamais de snapshot
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
    END IF;

    -- Incrément atomique de l'inventaire
    SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
    v_cur := v_cur + v_line.quantity;
    UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

    -- products.stock = stock relu + quantité reçue
    v_stock := v_stock + v_line.quantity;
    UPDATE products SET stock = v_stock WHERE id = v_line.product_id;

    INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, unit_price, supplier_id, movement_date, notes, reason, reference_type, reference_id)
    VALUES (v_inv_id, v_line.product_id, v_org, 'in', v_line.quantity, v_line.unit_price, v_po.supplier_id,
            CURRENT_DATE, 'Réception BC - ' || v_line.product_name, 'reception', 'purchase_order', p_order_id);

    v_created := v_created + 1;
  END LOOP;

  -- Lignes restantes dont le produit a été supprimé (product_id NULL)
  SELECT COUNT(*) INTO v_skipped
  FROM purchase_order_items poi
  LEFT JOIN products p ON p.id = poi.product_id
  WHERE poi.purchase_order_id = p_order_id AND p.id IS NULL;

  -- Passage en 'received' -> le trigger 00073 crée la dépense unique
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

-- ---------------------------------------------------------------------------
-- S5. stock_movements.inventory_id : ON DELETE CASCADE -> RESTRICT
--  La suppression d'une fiche d'inventaire ayant des mouvements est désormais
--  refusée par la base (l'historique n'est JAMAIS perdu). Les triggers de
--  nettoyage (00083) ne suppriment déjà que les fiches sans mouvement.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_conname text;
  v_attnum int;
BEGIN
  SELECT attnum INTO v_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.stock_movements'::regclass AND attname = 'inventory_id';
  IF v_attnum IS NOT NULL THEN
    SELECT conname INTO v_conname
    FROM pg_constraint
    WHERE conrelid = 'public.stock_movements'::regclass
      AND contype = 'f'
      AND confrelid = 'public.inventory'::regclass
      AND conkey = ARRAY[v_attnum::smallint];
    IF v_conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', v_conname);
    END IF;
  END IF;
END $$;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_inventory_id_fkey
  FOREIGN KEY (inventory_id) REFERENCES public.inventory(id)
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- S8. sync_stock_movement_to_expense : expense_date = NEW.movement_date
--  (au lieu de CURRENT_DATE) pour les saisies rétroactives de stock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_stock_movement_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_unit_price DECIMAL(10,2);
  v_amount DECIMAL(10,2);
BEGIN
  IF NEW.type != 'in' THEN
    RETURN NEW;
  END IF;
  IF NEW.reason IS NOT NULL AND NEW.reason != 'achat' THEN
    RETURN NEW;
  END IF;

  IF NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
    v_unit_price := NEW.unit_price;
    SELECT id, organization_id, name INTO v_inv
    FROM inventory WHERE id = NEW.inventory_id;
    IF v_inv IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    SELECT id, price, organization_id, name INTO v_inv
    FROM inventory WHERE id = NEW.inventory_id;
    IF v_inv IS NULL OR v_inv.price IS NULL OR v_inv.price <= 0 THEN
      RETURN NEW;
    END IF;
    v_unit_price := v_inv.price;
  END IF;

  v_amount := v_unit_price * NEW.quantity;

  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE reference_type = 'stock_movement' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, reference_type, reference_id)
  VALUES (
    v_inv.organization_id, 'products',
    'Achat stock - ' || COALESCE(v_inv.name, 'Article inconnu') || ' (' || NEW.quantity || ' x ' || v_unit_price || ' DA)',
    v_amount, COALESCE(NEW.movement_date, CURRENT_DATE), NULL, 'stock_movement', NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger existant (00078) pointé sur la fonction : recréé pour garantir l'association
DROP TRIGGER IF EXISTS trg_sync_stock_movement_to_expense ON public.stock_movements;
CREATE TRIGGER trg_sync_stock_movement_to_expense
AFTER INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_stock_movement_to_expense();
