-- Migration 00079: Lier products <-> stock_movements, prix d'achat par ligne, rajout de stock
-- =============================================================================
-- REGLE APPLICATIVE : UN PRODUIT = UNE FICHE.
--   - Chaque achat de stock = un RAJOUT = une ligne stock_movements 'in' avec
--     prix d'achat unitaire (unit_price), fournisseur, reference et date --
--     l'historique n'est JAMAIS ecrase.
--   - products.stock = STOCK CALCULE : maintenu atomiquement par les RPCs
--     (record_product_stock_add/out). Le helper product_expected_stock() calcule
--     la valeur attendue (stock_initial + sum(in) - sum(out)) pour signaler les
--     ecarts dans l'UI -- on signale, on ne corrige jamais silencieusement
--     (meme philosophie que la migration 00078).
--   - stock_movements.product_id relie le mouvement au produit (products.id) ;
--     inventory.product_id relie la fiche d'inventaire au produit.
--   - Le POS continue d'utiliser decrement_product_stock comme garde atomique ;
--     record_pos_sale_stock journalise la sortie avec product_id + unit_price.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. inventory.product_id : lien fiche d'inventaire <-> produit
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory (product_id);

-- Backfill : associe chaque produit a sa fiche d'inventaire (meme nom + org).
-- En cas de doublons historiques, seul le premier article est lie.
UPDATE inventory i
SET product_id = m.pid
FROM (
  SELECT DISTINCT ON (p.id) p.id AS pid, i.id AS iid
  FROM products p
  JOIN inventory i
    ON i.organization_id = p.organization_id
   AND lower(i.name) = lower(p.name)
  ORDER BY p.id, i.created_at
) m
WHERE i.id = m.iid AND i.product_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2. stock_movements : product_id + prix d'achat + fournisseur + reference + date
-- ---------------------------------------------------------------------------
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS movement_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_created ON stock_movements (product_id, created_at);

-- Backfill : propage le lien produit depuis la fiche d'inventaire
UPDATE stock_movements sm
SET product_id = i.product_id
FROM inventory i
WHERE sm.inventory_id = i.id
  AND i.product_id IS NOT NULL
  AND sm.product_id IS NULL;

-- Backfill : date de mouvement = date de creation ; prix d'achat des entrees
-- historiques = prix de la fiche d'inventaire liee (quand disponible)
UPDATE stock_movements sm
SET movement_date = sm.created_at::date
WHERE sm.movement_date IS NULL;

UPDATE stock_movements sm
SET unit_price = i.price
FROM inventory i
WHERE sm.inventory_id = i.id
  AND i.price IS NOT NULL AND i.price > 0
  AND sm.type = 'in'
  AND sm.unit_price IS NULL;

-- ---------------------------------------------------------------------------
-- 3. products.stock_initial : point de depart du calcul de stock produit
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_initial INT NOT NULL DEFAULT 0;

-- Backfill : stock_initial = stock actuel - (sum(in) - sum(out)) des mouvements lies.
-- (borne >= 0 ; si < 0, la fiche signalera l'ecart -- on ne corrige pas)
UPDATE products p
SET stock_initial = GREATEST(0, COALESCE(p.stock, 0) - COALESCE((
  SELECT SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE -sm.quantity END)
  FROM stock_movements sm WHERE sm.product_id = p.id
), 0));

-- ---------------------------------------------------------------------------
-- 4. Helper : stock calcule produit = stock_initial + sum(in) - sum(out)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_expected_stock(p_product_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p.stock_initial, 0) + COALESCE((
    SELECT SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE -sm.quantity END)
    FROM stock_movements sm WHERE sm.product_id = p.id
  ), 0)
  FROM products p WHERE p.id = p_product_id
$$;

-- ---------------------------------------------------------------------------
-- 5. RPC record_product_stock_add : RAJOUT DE STOCK (achat) sur un produit
--    - trouve ou cree la fiche d'inventaire liee au produit
--    - met a jour inventory.quantity ET products.stock de facon atomique
--    - insere UNE ligne stock_movements 'in' avec unit_price/supplier/reference
-- ---------------------------------------------------------------------------
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

  -- Fiche d'inventaire liee (par product_id, sinon par nom+org)
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

  -- Creation de la fiche si absente : quantity/stock_initial = stock produit actuel
  -- pour que calcule == actuel des la premiere entree (regle 00078)
  IF v_inv_id IS NULL THEN
    INSERT INTO inventory (organization_id, name, category, unit, price, supplier_id, quantity, stock_initial, product_id)
    VALUES (v_org, v_product.name, v_product.category, 'piece',
            COALESCE(p_unit_price, v_product.cost, 0), p_supplier_id,
            COALESCE(v_product.stock, 0), COALESCE(v_product.stock, 0), p_product_id)
    RETURNING id INTO v_inv_id;
  ELSE
    UPDATE inventory SET product_id = p_product_id WHERE id = v_inv_id;
  END IF;

  -- Mise a jour atomique de la quantite d'inventaire
  SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
  v_cur := v_cur + p_quantity;
  UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

  -- products.stock = stock calcule (maintenu atomiquement)
  v_stock := COALESCE(v_product.stock, 0) + p_quantity;
  UPDATE products SET stock = v_stock WHERE id = p_product_id;

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

-- ---------------------------------------------------------------------------
-- 6. RPC record_product_stock_out : SORTIE / AJUSTEMENT sur un produit
--    (perte, casse, ajustement...). Garde : jamais negatif (produit + inventaire).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_product_stock_out(
  p_product_id uuid,
  p_quantity int,
  p_reason text DEFAULT 'ajustement',
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

  IF COALESCE(v_product.stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient product stock: % < %', COALESCE(v_product.stock, 0), p_quantity;
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
            v_product.cost, NULL,
            COALESCE(v_product.stock, 0), COALESCE(v_product.stock, 0), p_product_id)
    RETURNING id INTO v_inv_id;
  ELSE
    UPDATE inventory SET product_id = p_product_id WHERE id = v_inv_id;
  END IF;

  SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
  IF v_cur < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % < %', v_cur, p_quantity;
  END IF;
  v_cur := v_cur - p_quantity;
  UPDATE inventory SET quantity = v_cur WHERE id = v_inv_id;

  -- products.stock = stock calcule (maintenu atomiquement)
  v_stock := COALESCE(v_product.stock, 0) - p_quantity;
  UPDATE products SET stock = v_stock WHERE id = p_product_id;

  INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, movement_date, notes, reason)
  VALUES (v_inv_id, p_product_id, v_org, 'out', p_quantity, CURRENT_DATE, p_notes, p_reason);

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

GRANT EXECUTE ON FUNCTION public.record_product_stock_out(uuid, int, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. record_pos_sale_stock : match par product_id en priorite (fallback nom),
--    journalise product_id + unit_price (prix de vente) + date de la vente.
--    Ne decremente PAS products.stock ici : la garde atomique POS le fait.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_pos_sale_stock(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx public.pos_transactions%ROWTYPE;
  v_item jsonb;
  v_prod_id text;
  v_prod_uuid uuid;
  v_qty int;
  v_unit_price numeric;
  v_inv_id uuid;
  v_cur int;
  v_created int := 0;
BEGIN
  SELECT * INTO v_tx FROM pos_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF NOT public.is_encaissement_operator(v_tx.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF v_tx.payment_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'created', 0, 'cancelled', true);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_tx.items) LOOP
    v_prod_id := v_item->>'id';
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_unit_price := COALESCE((v_item->>'price')::numeric, NULL);
    -- Ignorer les items virtuels (abonnement/renouvellement/seance)
    IF v_prod_id IS NULL OR v_prod_id LIKE '\_\_%' OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Trouver le produit par son id (fallback : nom)
    v_prod_uuid := NULL;
    BEGIN
      v_prod_uuid := v_prod_id::uuid;
    EXCEPTION WHEN others THEN
      v_prod_uuid := NULL;
    END;

    -- Article inventaire : par product_id en priorite, puis par nom
    v_inv_id := NULL;
    IF v_prod_uuid IS NOT NULL THEN
      SELECT id INTO v_inv_id
      FROM inventory
      WHERE organization_id = v_tx.organization_id
        AND product_id = v_prod_uuid
      LIMIT 1;
    END IF;
    IF v_inv_id IS NULL THEN
      SELECT id INTO v_inv_id
      FROM inventory
      WHERE organization_id = v_tx.organization_id
        AND lower(name) = lower(v_item->>'name')
      LIMIT 1;
    END IF;
    IF v_inv_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Decremente l'inventaire avec garde : jamais negatif (la fiche signalera si ecart)
    SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
    UPDATE inventory
    SET quantity = GREATEST(0, quantity - v_qty)
    WHERE id = v_inv_id;

    INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, unit_price, movement_date, notes, reason, reference_type, reference_id)
    VALUES (v_inv_id, v_prod_uuid, v_tx.organization_id, 'out', v_qty, v_unit_price, v_tx.created_at::date, v_item->>'name', 'vente', 'pos_transaction', p_transaction_id)
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'transaction_id', p_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale_stock(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Reverse (annulation) : propage product_id sur le mouvement inverse pour
--    que la fiche produit affiche correctement l'historique.
--    products.stock est restaure par _restore_pos_stock (00077), pas ici.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reverse_pos_stock_movements(p_transaction public.pos_transactions)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mv public.stock_movements%ROWTYPE;
BEGIN
  FOR v_mv IN
    SELECT sm.* FROM stock_movements sm
    WHERE sm.reference_type = 'pos_transaction'
      AND sm.reference_id = p_transaction.id
      AND sm.type = 'out'
  LOOP
    UPDATE inventory
    SET quantity = quantity + v_mv.quantity
    WHERE id = v_mv.inventory_id;

    INSERT INTO stock_movements (inventory_id, product_id, organization_id, type, quantity, movement_date, notes, reason, reference_type, reference_id)
    VALUES (v_mv.inventory_id, v_mv.product_id, v_mv.organization_id, 'in', v_mv.quantity,
            CURRENT_DATE, 'Annulation vente', 'annulation', 'pos_transaction', p_transaction.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Adapte le trigger de depense (00075/00078) : le prix d'achat unitaire de
--     la ligne (unit_price) prime sur le prix de la fiche d'inventaire.
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
    v_amount, CURRENT_DATE, NULL, 'stock_movement', NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_stock_movement_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_unit_price DECIMAL(10,2);
  v_amount DECIMAL(10,2);
  v_name TEXT;
BEGIN
  IF OLD.type = 'in' AND NEW.type != 'in' THEN
    DELETE FROM expenses WHERE reference_type = 'stock_movement' AND reference_id = OLD.id;
    RETURN NEW;
  END IF;

  IF NEW.type = 'in' AND (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.reason IS DISTINCT FROM NEW.reason OR OLD.unit_price IS DISTINCT FROM NEW.unit_price) THEN
    IF NEW.reason IS NOT NULL AND NEW.reason != 'achat' THEN
      DELETE FROM expenses WHERE reference_type = 'stock_movement' AND reference_id = NEW.id;
      RETURN NEW;
    END IF;

    IF NEW.unit_price IS NOT NULL AND NEW.unit_price > 0 THEN
      v_unit_price := NEW.unit_price;
      SELECT id, organization_id, name INTO v_inv FROM inventory WHERE id = NEW.inventory_id;
      IF v_inv IS NULL THEN
        RETURN NEW;
      END IF;
    ELSE
      SELECT id, price, organization_id, name INTO v_inv FROM inventory WHERE id = NEW.inventory_id;
      IF v_inv IS NULL OR v_inv.price IS NULL OR v_inv.price <= 0 THEN
        RETURN NEW;
      END IF;
      v_unit_price := v_inv.price;
    END IF;

    v_name := COALESCE(v_inv.name, 'Article inconnu');
    v_amount := v_unit_price * NEW.quantity;
    UPDATE expenses
    SET amount = v_amount,
        description = 'Achat stock - ' || v_name || ' (' || NEW.quantity || ' x ' || v_unit_price || ' DA)'
    WHERE reference_type = 'stock_movement' AND reference_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
