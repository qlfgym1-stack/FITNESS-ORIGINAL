-- Migration 00061: Fix RPC authorization
-- Ré-applique la correction de 00027 (écrasée par 00060) :
--   1. create_member_with_pending_subscription : retrait de SECURITY DEFINER + check admin
--   2. finalize_subscription_payment : check admin (role 'super_admin' fusionné dans 'admin' depuis 00059)

-- 1. create_member_with_pending_subscription
CREATE OR REPLACE FUNCTION create_member_with_pending_subscription(
  p_organization_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_subscription_type_id UUID,
  p_start_date DATE,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_emergency_phone TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_corporate_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_id UUID;
  v_subscription_id UUID;
  v_type subscription_types;
  v_end_date DATE;
BEGIN
  -- Authorization: seule un admin de l'organisation peut créer membre + abonnement
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin can create subscriptions';
  END IF;

  INSERT INTO members (
    organization_id, first_name, last_name, email, phone, gender,
    birth_date, address, emergency_contact, emergency_phone, photo_url,
    status, last_visit, notes, corporate_id
  ) VALUES (
    p_organization_id, p_first_name, p_last_name, p_email, p_phone, p_gender,
    p_birth_date, p_address, p_emergency_contact, p_emergency_phone, p_photo_url,
    'active', NULL, NULL, p_corporate_id
  )
  RETURNING id INTO v_member_id;

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
    p_organization_id, v_member_id, p_subscription_type_id,
    p_start_date, v_end_date, v_type.price, 0, 'pending_payment'
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'subscription_id', v_subscription_id,
    'total_amount', v_type.price,
    'subscription_name', v_type.name,
    'organization_id', p_organization_id,
    'first_name', p_first_name,
    'last_name', p_last_name
  );
END;
$$;

-- 2. finalize_subscription_payment
CREATE OR REPLACE FUNCTION finalize_subscription_payment(
  p_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_payment_method TEXT,
  p_amount DECIMAL(10,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub member_subscriptions;
  v_payment_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin can finalize payments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_subscription_id
      AND organization_id = p_organization_id
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
    RAISE EXCEPTION 'Subscription is not pending payment';
  END IF;

  UPDATE member_subscriptions
  SET status = 'active',
      amount_paid = p_amount
  WHERE id = p_subscription_id;

  INSERT INTO payments (
    organization_id, member_id, subscription_id, amount,
    payment_date, payment_method, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_id, p_amount,
    now(), p_payment_method, 'completed'
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', p_subscription_id,
    'payment_id', v_payment_id
  );
END;
$$;
