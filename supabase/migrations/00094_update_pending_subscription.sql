-- Migration 00094: Modifier un abonnement en attente (pending_payment)
-- Depuis le POS : corriger le type d'abonnement et/ou la date de début d'un
-- abonnement non encore payé, sans recréer membre ni abonnement.
-- Recalcule end_date (start_date + duration_days) et total_amount (= prix du type).
-- Pattern de sécurité identique à 00065 : pas de SECURITY DEFINER,
-- check role (admin, receptionist) + appartenance org + verrouillage FOR UPDATE.

CREATE OR REPLACE FUNCTION public.update_pending_subscription(
  p_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_subscription_type_id UUID,
  p_start_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub member_subscriptions;
  v_type subscription_types;
  v_end_date DATE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can update subscriptions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_subscription_id
      AND organization_id = p_organization_id
      AND member_id = p_member_id
  ) THEN
    RAISE EXCEPTION 'Subscription does not belong to this organization';
  END IF;

  SELECT * INTO v_sub
  FROM member_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_sub.status != 'pending_payment' THEN
    RAISE EXCEPTION 'Only pending payment subscriptions can be modified';
  END IF;

  SELECT * INTO v_type
  FROM subscription_types
  WHERE id = p_subscription_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription type not found';
  END IF;

  v_end_date := p_start_date + (v_type.duration_days || ' days')::INTERVAL;

  UPDATE member_subscriptions
  SET subscription_type_id = p_subscription_type_id,
      start_date = p_start_date,
      end_date = v_end_date,
      total_amount = v_type.price
  WHERE id = p_subscription_id;

  RETURN jsonb_build_object(
    'subscription_id', p_subscription_id,
    'total_amount', v_type.price,
    'subscription_name', v_type.name,
    'start_date', p_start_date,
    'end_date', v_end_date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pending_subscription(uuid, uuid, uuid, uuid, date) TO authenticated;
