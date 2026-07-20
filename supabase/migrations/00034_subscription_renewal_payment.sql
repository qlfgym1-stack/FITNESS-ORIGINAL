-- Migration 00034: Subscription renewal with atomic payment recording
-- Purpose:
--   1. Add `pay_and_renew` RPC: expires old subscription, creates new active
--      subscription, and records payment in a single atomic transaction.
--      Includes authorization (admin/super_admin only), cross-org validation,
--      and FOR UPDATE row locking to prevent race conditions.
--   2. Harden existing `renew_subscription` RPC with the same authorization,
--      cross-org check, and FOR UPDATE lock (no payment recording — kept for
--      backwards compatibility).

-- =============================================================================
-- 1. pay_and_renew: atomic payment + renewal
-- =============================================================================
CREATE OR REPLACE FUNCTION pay_and_renew(
  p_old_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_subscription_type_id UUID,
  p_new_start_date DATE,
  p_new_end_date DATE,
  p_total_amount DECIMAL(10,2),
  p_payment_method TEXT,
  p_payment_amount DECIMAL(10,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_sub member_subscriptions;
  v_new_subscription_id UUID;
  v_payment_id UUID;
BEGIN
  -- Authorization: only admin or super_admin may renew + pay
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can renew subscriptions';
  END IF;

  -- Cross-organization check: old subscription must belong to the same org
  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_old_subscription_id
      AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Old subscription does not belong to this organization';
  END IF;

  -- FOR UPDATE lock on old subscription to prevent concurrent renewals
  SELECT * INTO v_old_sub
  FROM member_subscriptions
  WHERE id = p_old_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Old subscription not found';
  END IF;

  -- Validate old subscription status
  IF v_old_sub.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'Old subscription must be active or expired to renew (current status: %)', v_old_sub.status;
  END IF;

  -- Expire old subscription
  UPDATE member_subscriptions
  SET status = 'expired'
  WHERE id = p_old_subscription_id;

  -- Create new subscription as active with amount_paid = payment amount
  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_type_id,
    p_new_start_date, p_new_end_date, p_total_amount, p_payment_amount, 'active'
  )
  RETURNING id INTO v_new_subscription_id;

  -- Record payment
  INSERT INTO payments (
    organization_id, member_id, subscription_id, amount,
    payment_date, payment_method, status
  ) VALUES (
    p_organization_id, p_member_id, v_new_subscription_id, p_payment_amount,
    now(), p_payment_method, 'completed'
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_subscription_id', v_new_subscription_id,
    'payment_id', v_payment_id
  );
END;
$$;

-- =============================================================================
-- 2. Harden renew_subscription: add authorization, cross-org check, FOR UPDATE
--    This RPC is kept for backwards compatibility (renewal without payment).
-- =============================================================================
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
  v_old_sub member_subscriptions;
  v_new_subscription_id UUID;
BEGIN
  -- Authorization: only admin or super_admin may renew
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or super_admin can renew subscriptions';
  END IF;

  -- Cross-organization check: old subscription must belong to the same org
  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_old_subscription_id
      AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Old subscription does not belong to this organization';
  END IF;

  -- FOR UPDATE lock on old subscription to prevent concurrent renewals
  SELECT * INTO v_old_sub
  FROM member_subscriptions
  WHERE id = p_old_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Old subscription not found';
  END IF;

  -- Validate old subscription status
  IF v_old_sub.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'Old subscription must be active or expired to renew (current status: %)', v_old_sub.status;
  END IF;

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
