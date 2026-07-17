-- RPC to assign super_admin role by email
-- Usage: SELECT assign_admin_role_by_email('MoussaMohamedelmabrouk@gmail.com', 'dinatek');
CREATE OR REPLACE FUNCTION assign_admin_role_by_email(p_email TEXT, p_org_slug TEXT DEFAULT 'dinatek')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Get user from auth
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found in auth.users');
  END IF;

  -- Get or create org
  INSERT INTO organizations (name, slug)
  VALUES (p_email, p_org_slug)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_org_id;

  -- Assign role
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'super_admin')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'super_admin';

  RETURN jsonb_build_object('user_id', v_user_id, 'organization_id', v_org_id, 'role', 'super_admin');
END;
$$;
