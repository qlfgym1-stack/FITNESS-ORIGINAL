-- ============================================================================
-- Migration 00095: Créer un abonnement en attente (pending_payment) pour un
-- membre EXISTANT, directement depuis le POS.
--
-- Objectif : au POS, l'utilisateur (admin/réceptionniste) sélectionne un membre,
-- choisit un type d'abonnement et une date de début → le RPC crée une ligne
-- member_subscriptions avec status 'pending_payment' (end_date calculée, prix du
-- type). Le checkout POS finalise ensuite via finalize_subscription_payment.
--
-- Pattern de sécurité identique à 00094 / 00065 : pas de SECURITY DEFINER,
-- check rôle (admin, receptionist) + appartenance org + appartenance membre.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_pending_subscription(
  p_organization_id UUID,
  p_member_id UUID,
  p_subscription_type_id UUID,
  p_start_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_type subscription_types;
  v_end_date DATE;
  v_member RECORD;
  v_subscription_id UUID;
BEGIN
  -- Authorization: admin ou réception de l'organisation
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can create subscriptions';
  END IF;

  -- Le membre doit appartenir à l'organisation
  SELECT id, first_name, last_name INTO v_member
  FROM members
  WHERE id = p_member_id
    AND organization_id = p_organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member does not belong to this organization';
  END IF;

  SELECT * INTO v_type
  FROM subscription_types
  WHERE id = p_subscription_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription type not found';
  END IF;

  v_end_date := p_start_date + (v_type.duration_days || ' days')::INTERVAL;

  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_type_id,
    p_start_date, v_end_date, v_type.price, 0, 'pending_payment'
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'member_id', p_member_id,
    'subscription_id', v_subscription_id,
    'total_amount', v_type.price,
    'subscription_name', v_type.name,
    'organization_id', p_organization_id,
    'first_name', v_member.first_name,
    'last_name', v_member.last_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pending_subscription(uuid, uuid, uuid, date) TO authenticated;
