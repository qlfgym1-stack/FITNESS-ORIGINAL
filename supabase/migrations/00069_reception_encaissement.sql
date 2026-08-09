-- Migration 00069: Réception → accès complet au module Encaissements
-- =============================================================================
-- Décision utilisateur : la réception doit pouvoir consulter ET modifier/annuler
-- les encaissements (payments + pos_transactions).
--   1. RLS : payments lisible par `receptionist` (cleaner toujours bloqué)
--   2. RLS : payment_changes lisible par `receptionist` (module encaissements)
--   3. RPC  : modify_payment / cancel_payment / cancel_pos_transaction élargis à
--      (admin, receptionist) — `is_encaissement_operator` helper
--   NOTA : whatsapp_outbox + generate_expiring_notifications restent admin-only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper : caller est-il admin OU receptionist de l'organisation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_encaissement_operator(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_org_id
      AND ur.role IN ('admin', 'receptionist')
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. RLS payments : ouverture lecture à `receptionist` (cleaner reste bloqué)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;
CREATE POLICY "Staff can view payments" ON public.payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payments.organization_id
        AND ur.role = 'cleaner'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. RLS payment_changes : lecture élargie à (admin, receptionist)
--    Toujours aucune policy INSERT/UPDATE/DELETE → immuable.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view payment_changes" ON public.payment_changes;
CREATE POLICY "Admins can view payment_changes" ON public.payment_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payment_changes.organization_id
        AND ur.role IN ('admin', 'receptionist')
    )
  );

-- ---------------------------------------------------------------------------
-- 3. RPCs encaissements : authorization (admin, receptionist)
-- ---------------------------------------------------------------------------

-- 3.1 modify_payment
CREATE OR REPLACE FUNCTION public.modify_payment(
  p_payment_id UUID,
  p_new_amount DECIMAL(10,2),
  p_new_date TIMESTAMPTZ,
  p_new_method TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF NOT is_encaissement_operator(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF p_new_amount IS NULL OR p_new_amount < 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  IF p_new_method NOT IN ('cash', 'card', 'transfer', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  UPDATE public.payments
  SET amount = p_new_amount, payment_date = COALESCE(p_new_date, payment_date), payment_method = p_new_method
  WHERE id = p_payment_id;

  INSERT INTO public.payment_changes (organization_id, user_id, member_id, source, payment_id, action, old_data, new_data, reason)
  VALUES (
    v_old.organization_id, auth.uid(), v_old.member_id, 'subscription', p_payment_id, 'modify',
    jsonb_build_object('amount', v_old.amount, 'payment_date', v_old.payment_date, 'payment_method', v_old.payment_method),
    jsonb_build_object('amount', p_new_amount, 'payment_date', COALESCE(p_new_date, v_old.payment_date), 'payment_method', p_new_method),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id);
END;
$$;

-- 3.2 cancel_payment
CREATE OR REPLACE FUNCTION public.cancel_payment(
  p_payment_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.payments%ROWTYPE;
BEGIN
  SELECT * INTO v_old FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF NOT is_encaissement_operator(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF v_old.status = 'cancelled' THEN
    RAISE EXCEPTION 'Payment already cancelled';
  END IF;

  UPDATE public.payments
  SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_reason = p_reason
  WHERE id = p_payment_id;

  INSERT INTO public.payment_changes (organization_id, user_id, member_id, source, payment_id, action, old_data, new_data, reason)
  VALUES (
    v_old.organization_id, auth.uid(), v_old.member_id, 'subscription', p_payment_id, 'cancel',
    jsonb_build_object('status', v_old.status, 'amount', v_old.amount, 'payment_method', v_old.payment_method),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id);
END;
$$;

-- 3.3 cancel_pos_transaction
CREATE OR REPLACE FUNCTION public.cancel_pos_transaction(
  p_transaction_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.pos_transactions%ROWTYPE;
  v_item jsonb;
  v_prod_id text;
  v_qty int;
BEGIN
  SELECT * INTO v_old FROM public.pos_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  IF NOT is_encaissement_operator(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin or receptionist only';
  END IF;
  IF COALESCE(p_reason, '') = '' THEN
    RAISE EXCEPTION 'A reason is required';
  END IF;
  IF v_old.payment_status = 'cancelled' THEN
    RAISE EXCEPTION 'Transaction already cancelled';
  END IF;

  -- Restauration du stock pour les articles physiques (hors articles virtuels __subscription__/__renewal__/__dropin__)
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_old.items) LOOP
    v_prod_id := v_item->>'id';
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    IF v_prod_id IS NOT NULL
      AND v_prod_id NOT LIKE '\_\_%'
      AND v_qty > 0 THEN
      UPDATE public.products
      SET stock = stock + v_qty
      WHERE id = v_prod_id::uuid AND organization_id = v_old.organization_id;
    END IF;
  END LOOP;

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

  RETURN jsonb_build_object('success', true, 'pos_transaction_id', p_transaction_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants (fonctions déjà recréées — re-grant par sécurité)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.modify_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pos_transaction(UUID, TEXT) TO authenticated;
