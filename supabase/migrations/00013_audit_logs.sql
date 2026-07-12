-- Migration 00013: Global audit log system
-- Tracks all CRUD operations on critical tables

-- ── audit_logs table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND organization_id = audit_logs.organization_id
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── SECURITY DEFINER RPC to insert audit logs ────────────────────
CREATE OR REPLACE FUNCTION log_audit_event(
  p_organization_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
  VALUES (p_organization_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data, p_ip_address)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Trigger: audit members changes ───────────────────────────────
CREATE OR REPLACE FUNCTION audit_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(v_org_id, 'INSERT', 'members', NEW.id, NULL, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(v_org_id, 'UPDATE', 'members', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(v_org_id, 'DELETE', 'members', OLD.id, row_to_json(OLD)::jsonb, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_members ON members;
CREATE TRIGGER trg_audit_members
  AFTER INSERT OR UPDATE OR DELETE ON members
  FOR EACH ROW EXECUTE FUNCTION audit_members();

-- ── Trigger: audit payments changes ──────────────────────────────
CREATE OR REPLACE FUNCTION audit_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(v_org_id, 'INSERT', 'payments', NEW.id, NULL, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(v_org_id, 'UPDATE', 'payments', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(v_org_id, 'DELETE', 'payments', OLD.id, row_to_json(OLD)::jsonb, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_payments ON payments;
CREATE TRIGGER trg_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_payments();

-- ── Trigger: audit member_subscriptions changes ──────────────────
CREATE OR REPLACE FUNCTION audit_member_subscriptions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(v_org_id, 'INSERT', 'member_subscriptions', NEW.id, NULL, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(v_org_id, 'UPDATE', 'member_subscriptions', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(v_org_id, 'DELETE', 'member_subscriptions', OLD.id, row_to_json(OLD)::jsonb, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_member_subscriptions ON member_subscriptions;
CREATE TRIGGER trg_audit_member_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON member_subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit_member_subscriptions();

-- ── Trigger: audit staff changes ─────────────────────────────────
CREATE OR REPLACE FUNCTION audit_staff()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(v_org_id, 'INSERT', 'staff', NEW.id, NULL, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(v_org_id, 'UPDATE', 'staff', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(v_org_id, 'DELETE', 'staff', OLD.id, row_to_json(OLD)::jsonb, NULL);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_staff ON staff;
CREATE TRIGGER trg_audit_staff
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION audit_staff();
