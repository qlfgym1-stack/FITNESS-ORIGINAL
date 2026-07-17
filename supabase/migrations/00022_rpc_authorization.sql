-- Fix finalize_subscription_payment: add authorization + cross-org check
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
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can finalize payments';
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
