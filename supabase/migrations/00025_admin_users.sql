-- Migration 00025: Admin User Management
-- Ajoute une table d'audit pour les actions admin sur les utilisateurs

-- 1. Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create_user', 'delete_user', 'reset_password', 'update_user', 'update_role')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_email TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- 3. RLS
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Seuls les super_admin peuvent voir les logs
CREATE POLICY "Super admins can view audit logs"
ON admin_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = admin_audit_log.organization_id
      AND role = 'super_admin'
  )
);

-- Insert via service_role uniquement (appelé par EF)
CREATE POLICY "Service role can insert audit logs"
ON admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (auth.role() = 'service_role');
