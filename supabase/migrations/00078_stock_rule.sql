-- Migration 00078: Règle de calcul de stock
-- =============================================================================
-- STOCK FINAL = STOCK INITIAL + TOTAL ENTRÉES − TOTAL SORTIES
--   - Chaque mouvement = ligne individuelle (stock_movements), jamais fusionné
--   - inventory.quantity = STOCK FINAL (valeur actuelle utilisée par le POS)
--   - Contrôle de cohérence APRÈS CHAQUE MOUVEMENT : si le stock calculé ≠ stock
--     actuel → SIGNALER une anomalie (stock_anomalies), NE JAMAIS corriger
--     silencieusement. L'admin régularise via un mouvement d'ajustement.
--   - Sync POS : chaque vente crée une sortie 'vente' référencée
--     (reference_type='pos_transaction') ; annulation → mouvement inverse 'annulation'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. stock_initial sur inventory + backfill (calculé == actuel sur l'existant)
-- ---------------------------------------------------------------------------
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS stock_initial INT NOT NULL DEFAULT 0;

-- Backfill : stock_initial = quantity − (Σin − Σout), borné ≥ 0
-- (si quantity < mouvement net, la fiche signalera l'anomalie — on ne corrige pas)
UPDATE inventory i
SET stock_initial = GREATEST(0, i.quantity - COALESCE((
  SELECT SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE -sm.quantity END)
  FROM stock_movements sm WHERE sm.inventory_id = i.id
), 0));

-- ---------------------------------------------------------------------------
-- 2. stock_movements : motif + référence (lien POS / bon d'achat / ajustement)
-- ---------------------------------------------------------------------------
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_stock_movements_reference
  ON stock_movements (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory_created
  ON stock_movements (inventory_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. stock_anomalies : journal des incohérences (signale, ne corrige pas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  computed_stock INT NOT NULL,
  actual_stock INT NOT NULL,
  delta INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Une seule anomalie ouverte par article à la fois
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_anomalies_open_per_item
  ON stock_anomalies (inventory_id) WHERE status = 'open';

ALTER TABLE stock_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage stock_anomalies" ON stock_anomalies;
CREATE POLICY "Admins can manage stock_anomalies" ON stock_anomalies
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = stock_anomalies.organization_id
          AND role = 'admin'
      )
  );

DROP POLICY IF EXISTS "Staff can view stock_anomalies" ON stock_anomalies;
CREATE POLICY "Staff can view stock_anomalies" ON stock_anomalies
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 4. Helper : stock calculé = stock_initial + Σin − Σout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_expected_stock(p_inventory_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(i.stock_initial, 0) + COALESCE((
    SELECT SUM(CASE WHEN sm.type = 'in' THEN sm.quantity ELSE -sm.quantity END)
    FROM stock_movements sm WHERE sm.inventory_id = i.id
  ), 0)
  FROM inventory i WHERE i.id = p_inventory_id
$$;

-- ---------------------------------------------------------------------------
-- 5. Trigger de cohérence sur stock_movements
--    Après chaque INSERT/UPDATE/DELETE : compare calculé vs actuel.
--    Égal → résout l'anomalie ouverte ; différent → signale (jamais corrige).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_stock_consistency_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv uuid;
  v_org uuid;
  v_expected int;
  v_actual int;
BEGIN
  v_inv := COALESCE(NEW.inventory_id, OLD.inventory_id);

  SELECT organization_id, quantity INTO v_org, v_actual
  FROM inventory WHERE id = v_inv;

  IF v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_expected := public.inventory_expected_stock(v_inv);

  IF v_expected = v_actual THEN
    UPDATE stock_anomalies
    SET status = 'resolved', resolved_at = now()
    WHERE inventory_id = v_inv AND status = 'open';
  ELSE
    INSERT INTO stock_anomalies (organization_id, inventory_id, computed_stock, actual_stock, delta, notes)
    VALUES (v_org, v_inv, v_expected, v_actual, v_expected - v_actual,
            'Écart détecté : calculé ' || v_expected || ' ≠ actuel ' || v_actual)
    ON CONFLICT (inventory_id) WHERE status = 'open'
    DO UPDATE SET
      computed_stock = EXCLUDED.computed_stock,
      actual_stock = EXCLUDED.actual_stock,
      delta = EXCLUDED.delta,
      detected_at = now(),
      notes = EXCLUDED.notes;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movement_consistency ON stock_movements;
CREATE TRIGGER trg_stock_movement_consistency
AFTER INSERT OR UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.check_stock_consistency_trigger();

-- ---------------------------------------------------------------------------
-- 6. RPC record_stock_movement : enregistre un mouvement ET met à jour
--    inventory.quantity de façon atomique (admin uniquement)
-- ---------------------------------------------------------------------------
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
  v_cur int;
  v_new int;
  v_expected int;
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

  -- Verrouille l'article
  SELECT quantity INTO v_cur
  FROM inventory
  WHERE id = p_inventory_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item not found in organization';
  END IF;

  IF p_type = 'out' AND v_cur < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock: % < %', v_cur, p_quantity;
  END IF;

  v_new := v_cur + CASE WHEN p_type = 'in' THEN p_quantity ELSE -p_quantity END;

  UPDATE inventory SET quantity = v_new WHERE id = p_inventory_id;

  INSERT INTO stock_movements (inventory_id, organization_id, type, quantity, notes, reason, reference_type, reference_id)
  VALUES (p_inventory_id, p_organization_id, p_type, p_quantity, p_notes, p_reason, p_reference_type, p_reference_id);

  v_expected := public.inventory_expected_stock(p_inventory_id);

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'quantity', v_new,
    'consistent', (v_expected = v_new)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, text, int, text, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPC check_stock_consistency : scan complet, upsert les anomalies, retourne
--    la liste des écarts (ne corrige rien)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_stock_consistency(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member boolean;
  v_rec record;
  v_result jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.organization_id = p_organization_id
  ) INTO v_member;
  IF NOT v_member THEN
    RAISE EXCEPTION 'Unauthorized: not a member of this organization';
  END IF;

  FOR v_rec IN
    SELECT i.id, i.name, i.quantity AS actual,
           public.inventory_expected_stock(i.id) AS expected
    FROM inventory i
    WHERE i.organization_id = p_organization_id
  LOOP
    IF v_rec.expected <> v_rec.actual THEN
      INSERT INTO stock_anomalies (organization_id, inventory_id, computed_stock, actual_stock, delta, notes)
      VALUES (p_organization_id, v_rec.id, v_rec.expected, v_rec.actual, v_rec.expected - v_rec.actual,
              'Écart détecté : calculé ' || v_rec.expected || ' ≠ actuel ' || v_rec.actual)
      ON CONFLICT (inventory_id) WHERE status = 'open'
      DO UPDATE SET
        computed_stock = EXCLUDED.computed_stock,
        actual_stock = EXCLUDED.actual_stock,
        delta = EXCLUDED.delta,
        detected_at = now(),
        notes = EXCLUDED.notes;
    ELSE
      UPDATE stock_anomalies
      SET status = 'resolved', resolved_at = now()
      WHERE inventory_id = v_rec.id AND status = 'open';
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'inventory_id', sa.inventory_id,
    'name', i.name,
    'computed_stock', sa.computed_stock,
    'actual_stock', sa.actual_stock,
    'delta', sa.delta,
    'detected_at', sa.detected_at
  )), '[]'::jsonb) INTO v_result
  FROM stock_anomalies sa
  JOIN inventory i ON i.id = sa.inventory_id
  WHERE sa.organization_id = p_organization_id AND sa.status = 'open';

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_stock_consistency(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RPC record_pos_sale_stock : sortie 'vente' pour chaque produit physique
--    d'une transaction POS, référencée vers pos_transactions.
--    Match par nom article inventaire = nom produit (même org). Si aucun article
--    inventaire ne correspond → aucun mouvement (produit non suivi en inventaire).
--    Ne fait JAMAIS échouer la vente : les échecs d'insertion sont ignorés.
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
  v_qty int;
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
    -- Ignorer les items virtuels (abonnement/renouvellement/séance)
    IF v_prod_id IS NULL OR v_prod_id LIKE '\_\_%' OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Article inventaire correspondant (par nom, même organisation)
    SELECT id INTO v_inv_id
    FROM inventory
    WHERE organization_id = v_tx.organization_id
      AND lower(name) = lower(v_item->>'name')
    LIMIT 1;
    IF v_inv_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Décrémente avec garde : jamais négatif (la fiche signalera si écart)
    SELECT quantity INTO v_cur FROM inventory WHERE id = v_inv_id FOR UPDATE;
    UPDATE inventory
    SET quantity = GREATEST(0, quantity - v_qty)
    WHERE id = v_inv_id;

    INSERT INTO stock_movements (inventory_id, organization_id, type, quantity, notes, reason, reference_type, reference_id)
    VALUES (v_inv_id, v_tx.organization_id, 'out', v_qty, v_item->>'name', 'vente', 'pos_transaction', p_transaction_id)
    ON CONFLICT DO NOTHING;

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_created, 'transaction_id', p_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pos_sale_stock(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 9. Annulation : mouvement inverse 'annulation' pour chaque sortie 'vente'
--    référencée — l'historique n'est JAMAIS supprimé, on contrebalance.
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

    INSERT INTO stock_movements (inventory_id, organization_id, type, quantity, notes, reason, reference_type, reference_id)
    VALUES (v_mv.inventory_id, v_mv.organization_id, 'in', v_mv.quantity,
            'Annulation vente', 'annulation', 'pos_transaction', p_transaction.id)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Réintègre le reverse dans l'annulation POS (migration 00077)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._cancel_pos_transaction_row(p_transaction_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old public.pos_transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.pos_transactions WHERE id = p_transaction_id;
  IF NOT FOUND OR v_old.payment_status = 'cancelled' THEN
    RETURN;
  END IF;

  PERFORM public._restore_pos_stock(v_old);
  PERFORM public._reverse_pos_stock_movements(v_old);

  UPDATE public.pos_transactions
  SET payment_status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  WHERE id = p_transaction_id;

  INSERT INTO public.payment_changes (organization_id, user_id, member_id, source, pos_transaction_id, action, old_data, new_data, reason)
  VALUES (
    v_old.organization_id, auth.uid(), v_old.member_id, 'pos', p_transaction_id, 'cancel',
    jsonb_build_object('status', v_old.payment_status, 'total', v_old.total, 'items', v_old.items),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_reason
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Fix trigger 00075 : la dépense 'Achat stock' ne doit être créée que pour
--     un motif 'achat' (ou legacy NULL). Les retours/ajustements/annulations
--     ne doivent PAS générer de dépense.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_stock_movement_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_amount DECIMAL(10,2);
BEGIN
  IF NEW.type != 'in' THEN
    RETURN NEW;
  END IF;
  IF NEW.reason IS NOT NULL AND NEW.reason != 'achat' THEN
    RETURN NEW;
  END IF;

  SELECT id, price, organization_id, name INTO v_inv
  FROM inventory WHERE id = NEW.inventory_id;

  IF v_inv IS NULL OR v_inv.price IS NULL OR v_inv.price <= 0 THEN
    RETURN NEW;
  END IF;

  v_amount := v_inv.price * NEW.quantity;

  IF EXISTS (
    SELECT 1 FROM expenses
    WHERE reference_type = 'stock_movement' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, reference_type, reference_id)
  VALUES (
    v_inv.organization_id, 'products',
    'Achat stock - ' || v_inv.name || ' (' || NEW.quantity || ' × ' || v_inv.price || ' DA)',
    v_amount, CURRENT_DATE, NULL, 'stock_movement', NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_stock_movement_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_inv RECORD;
  v_amount DECIMAL(10,2);
BEGIN
  IF OLD.type = 'in' AND NEW.type != 'in' THEN
    DELETE FROM expenses WHERE reference_type = 'stock_movement' AND reference_id = OLD.id;
    RETURN NEW;
  END IF;

  IF NEW.type = 'in' AND (OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.reason IS DISTINCT FROM NEW.reason) THEN
    IF NEW.reason IS NOT NULL AND NEW.reason != 'achat' THEN
      DELETE FROM expenses WHERE reference_type = 'stock_movement' AND reference_id = NEW.id;
      RETURN NEW;
    END IF;
    SELECT price, organization_id, name INTO v_inv FROM inventory WHERE id = NEW.inventory_id;
    IF v_inv IS NOT NULL AND v_inv.price > 0 THEN
      v_amount := v_inv.price * NEW.quantity;
      UPDATE expenses
      SET amount = v_amount,
          description = 'Achat stock - ' || COALESCE(v_inv.name, 'Article inconnu') || ' (' || NEW.quantity || ' × ' || v_inv.price || ' DA)'
      WHERE reference_type = 'stock_movement' AND reference_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_stock_movement_to_expense ON stock_movements;
CREATE TRIGGER trg_sync_stock_movement_to_expense
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.sync_stock_movement_to_expense();

DROP TRIGGER IF EXISTS trg_update_stock_movement_expense ON stock_movements;
CREATE TRIGGER trg_update_stock_movement_expense
AFTER UPDATE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_movement_expense();
