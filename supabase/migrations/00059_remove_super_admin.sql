-- Migration 00059: Fusion du rôle super_admin dans admin
-- Après cette migration, seul 'admin' / 'coach' / 'staff' existent.

-- 1. Données : promouvoir les super_admin existants en admin
UPDATE user_roles SET role = 'admin' WHERE role = 'super_admin';

-- 2. Contrainte CHECK : retirer 'super_admin'
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check CHECK (role IN ('admin', 'coach', 'staff'));

-- 3. Trigger auto_assign_owner_role : assigne désormais 'admin'
CREATE OR REPLACE FUNCTION auto_assign_owner_role()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), NEW.id, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. RPC d'assignation admin : 'admin' au lieu de 'super_admin'
CREATE OR REPLACE FUNCTION assign_admin_role_by_email(p_email TEXT, p_org_slug TEXT DEFAULT 'dinatek')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found in auth.users');
  END IF;

  INSERT INTO organizations (name, slug)
  VALUES (p_email, p_org_slug)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'admin')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'admin';

  RETURN jsonb_build_object('user_id', v_user_id, 'organization_id', v_org_id, 'role', 'admin');
END;
$$;
