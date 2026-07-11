-- Renew subscription: expire old one and create new one in a single transaction
CREATE OR REPLACE FUNCTION renew_subscription(
  p_old_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_subscription_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_total_amount DECIMAL(10,2),
  p_amount_paid DECIMAL(10,2)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_subscription_id UUID;
BEGIN
  -- Expire old subscription
  UPDATE member_subscriptions
  SET status = 'expired'
  WHERE id = p_old_subscription_id;

  -- Create new subscription
  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_type_id,
    p_start_date, p_end_date, p_total_amount, p_amount_paid, 'active'
  )
  RETURNING id INTO v_new_subscription_id;

  RETURN v_new_subscription_id;
END;
$$;
