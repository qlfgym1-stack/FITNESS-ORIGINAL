-- Fix create_member_with_pending_subscription: add authorization + remove SECURITY DEFINER
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
  p_photo_url TEXT DEFAULT NULL
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
  -- Authorization: only admin or super_admin can create members with subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can create subscriptions';
  END IF;

  -- Create member
  INSERT INTO members (
    organization_id, first_name, last_name, email, phone, gender,
    birth_date, address, emergency_contact, emergency_phone, photo_url,
    status, last_visit, notes
  ) VALUES (
    p_organization_id, p_first_name, p_last_name, p_email, p_phone, p_gender,
    p_birth_date, p_address, p_emergency_contact, p_emergency_phone, p_photo_url,
    'active', NULL, NULL
  )
  RETURNING id INTO v_member_id;

  -- Get subscription type to compute end_date
  SELECT * INTO v_type
  FROM subscription_types
  WHERE id = p_subscription_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription type not found';
  END IF;

  v_end_date := p_start_date + (v_type.duration_days || ' days')::INTERVAL;

  -- Create pending subscription
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
