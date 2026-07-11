-- Sync member_subscriptions.amount_paid when payments are inserted/updated/deleted
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Function to update amount_paid on member_subscriptions
CREATE OR REPLACE FUNCTION sync_subscription_amount_paid()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- When a payment is inserted or updated, recalculate amount_paid
    UPDATE member_subscriptions
    SET amount_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments
      WHERE subscription_id = NEW.subscription_id
        AND status = 'completed'
    )
    WHERE id = NEW.subscription_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- When a payment is deleted, recalculate amount_paid
    UPDATE member_subscriptions
    SET amount_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payments
      WHERE subscription_id = OLD.subscription_id
        AND status = 'completed'
    )
    WHERE id = OLD.subscription_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for INSERT on payments
CREATE TRIGGER after_payment_insert
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.subscription_id IS NOT NULL)
  EXECUTE FUNCTION sync_subscription_amount_paid();

-- Trigger for UPDATE on payments (status change or amount change)
CREATE TRIGGER after_payment_update
  AFTER UPDATE ON payments
  FOR EACH ROW
  WHEN (NEW.subscription_id IS NOT NULL)
  EXECUTE FUNCTION sync_subscription_amount_paid();

-- Trigger for DELETE on payments
CREATE TRIGGER after_payment_delete
  AFTER DELETE ON payments
  FOR EACH ROW
  WHEN (OLD.subscription_id IS NOT NULL)
  EXECUTE FUNCTION sync_subscription_amount_paid();
