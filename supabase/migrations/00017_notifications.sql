-- Notifications table enhancement
-- Adds message column, CHECK constraint on type, enhanced RLS, and create_notification RPC

-- Add message column (migration from body)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;

-- Backfill message from body where message is null
UPDATE notifications SET message = body WHERE message IS NULL;

-- Make message NOT NULL after backfill (only if table had rows; safe to run after backfill)
-- We add a default first to avoid errors on empty tables
ALTER TABLE notifications ALTER COLUMN message SET DEFAULT '';
UPDATE notifications SET message = '' WHERE message IS NULL;
ALTER TABLE notifications ALTER COLUMN message SET NOT NULL;

-- Add CHECK constraint on type (allows existing NULLs to stay, new rows must comply)
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('subscription_expiring', 'payment_overdue', 'member_checkin', 'staff_leave', 'system'));

-- Make user_id nullable (system notifications may not target a specific user)
ALTER TABLE notifications ALTER COLUMN user_id DROP NOT NULL;

-- Improve indexes
DROP INDEX IF EXISTS idx_notifications_user;
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
DROP INDEX IF EXISTS idx_notifications_org;
CREATE INDEX idx_notifications_org ON notifications(organization_id, created_at DESC);

-- Drop existing RLS policies and recreate with enhanced rules
DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Users in the same organization can view notifications
CREATE POLICY "Users can view org notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR auth.uid() IN (
      SELECT user_id FROM user_roles WHERE organization_id = notifications.organization_id
    )
  );

-- Users can mark their own notifications as read
CREATE POLICY "Users can mark own notifications read" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_read = true);

-- Service role can insert notifications
CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- create_notification RPC (SECURITY DEFINER for Edge Functions using service_role)
CREATE OR REPLACE FUNCTION create_notification(
  p_organization_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (organization_id, user_id, type, title, message, data)
  VALUES (p_organization_id, p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
