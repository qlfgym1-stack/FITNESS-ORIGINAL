-- Migration 00068: Encaissements (modifier/annuler) + Alertes + WhatsApp + Audit enrichi
-- =============================================================================
--   1. Annulation logique payments / pos_transactions (colonnes + status)
--   2. payment_changes  : historique immuable des modifications/annulations
--   3. whatsapp_outbox  : file de messages WhatsApp (jamais d'envoi auto)
--   4. RPCs admin-only  : modify_payment, cancel_payment, cancel_pos_transaction,
--      generate_expiring_notifications, log_whatsapp_message
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper : le caller est-il admin de l'organisation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_org_id
      AND ur.role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. Annulation logique payments
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- 2. Annulation logique pos_transactions + contrainte payment_status
ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

UPDATE public.pos_transactions SET payment_status = 'completed' WHERE payment_status IS NULL OR payment_status = '';

ALTER TABLE public.pos_transactions DROP CONSTRAINT IF EXISTS pos_transactions_payment_status_check;
ALTER TABLE public.pos_transactions
  ADD CONSTRAINT pos_transactions_payment_status_check
  CHECK (payment_status IN ('completed', 'pending', 'cancelled', 'refunded')) NOT VALID;

-- =============================================================================
-- 2. payment_changes — historique immuable des modifications / annulations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.payment_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('subscription', 'pos')),
  payment_id UUID,
  pos_transaction_id UUID,
  action TEXT NOT NULL CHECK (action IN ('modify', 'cancel')),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_changes_org ON public.payment_changes(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_changes_payment ON public.payment_changes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_changes_pos ON public.payment_changes(pos_transaction_id);

ALTER TABLE public.payment_changes ENABLE ROW LEVEL SECURITY;

-- Lecture : admin uniquement. Aucune policy INSERT/UPDATE/DELETE → immuable pour les users.
CREATE POLICY "Admins can view payment_changes" ON public.payment_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payment_changes.organization_id
        AND ur.role = 'admin'
    )
  );

-- =============================================================================
-- 3. whatsapp_outbox — file de messages WhatsApp (aucun envoi automatique)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT,
  phone TEXT,
  template_key TEXT NOT NULL DEFAULT 'renewal',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'sent_via_link', 'queued', 'sent', 'failed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_outbox_org ON public.whatsapp_outbox(organization_id, created_at DESC);

ALTER TABLE public.whatsapp_outbox ENABLE ROW LEVEL SECURITY;

-- Lecture : admin uniquement. Insertion uniquement via RPC log_whatsapp_message (SECURITY DEFINER).
CREATE POLICY "Admins can view whatsapp_outbox" ON public.whatsapp_outbox
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = whatsapp_outbox.organization_id
        AND ur.role = 'admin'
    )
  );

-- =============================================================================
-- 4. RPCs admin-only
-- =============================================================================

-- 4.1 modify_payment — corriger un encaissement abonnement (admin only)
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
  IF NOT is_admin(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
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

-- 4.2 cancel_payment — annulation logique d'un encaissement abonnement (admin only)
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
  IF NOT is_admin(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
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

-- 4.3 cancel_pos_transaction — annulation logique d'une vente POS + restauration stock (admin only)
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
  IF NOT is_admin(v_old.organization_id) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
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

-- 4.4 generate_expiring_notifications — alertes renouvellement pour les délais configurés (admin only)
CREATE OR REPLACE FUNCTION public.generate_expiring_notifications(p_delays INT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_max int;
  v_count int := 0;
  v_sub record;
  v_days int;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'admin'
  LIMIT 1;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  v_max := COALESCE((SELECT MAX(d) FROM unnest(p_delays) d), 7);

  FOR v_sub IN
    SELECT ms.id AS sub_id, ms.member_id, ms.end_date,
           m.first_name, m.last_name, m.phone, st.name AS sub_name
    FROM public.member_subscriptions ms
    JOIN public.members m ON m.id = ms.member_id
    JOIN public.subscription_types st ON st.id = ms.subscription_type_id
    WHERE ms.organization_id = v_org
      AND ms.status = 'active'
      AND ms.end_date >= CURRENT_DATE
      AND ms.end_date <= CURRENT_DATE + v_max
  LOOP
    v_days := v_sub.end_date - CURRENT_DATE;

    IF v_days = 0 OR EXISTS (SELECT 1 FROM unnest(p_delays) d WHERE d = v_days) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE organization_id = v_org
          AND type = 'subscription_expiring'
          AND data->>'member_subscription_id' = v_sub.sub_id::text
          AND created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (organization_id, user_id, type, title, message, data)
        SELECT v_org, ur.user_id, 'subscription_expiring',
               'Abonnement expire bientôt',
               format('L''abonnement de %s %s (%s) expire le %s — %s jour(s)',
                      v_sub.first_name, v_sub.last_name, v_sub.sub_name, v_sub.end_date, v_days),
               jsonb_build_object('member_subscription_id', v_sub.sub_id, 'member_id', v_sub.member_id, 'days_left', v_days)
        FROM public.user_roles ur
        WHERE ur.organization_id = v_org;
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('created', v_count, 'organization_id', v_org);
END;
$$;

-- 4.5 log_whatsapp_message — enregistre un message WhatsApp dans l'outbox (admin only)
CREATE OR REPLACE FUNCTION public.log_whatsapp_message(
  p_member_id UUID,
  p_member_name TEXT,
  p_phone TEXT,
  p_template_key TEXT,
  p_message TEXT,
  p_status TEXT DEFAULT 'sent_via_link'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_id uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.members WHERE id = p_member_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT is_admin(v_org) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;
  IF p_status NOT IN ('ready', 'sent_via_link', 'queued', 'sent', 'failed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  INSERT INTO public.whatsapp_outbox (organization_id, member_id, member_name, phone, template_key, message, status, created_by, sent_at)
  VALUES (v_org, p_member_id, p_member_name, p_phone, p_template_key, p_message, p_status, auth.uid(), now())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.modify_payment(UUID, DECIMAL, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pos_transaction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_expiring_notifications(INT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_whatsapp_message(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
