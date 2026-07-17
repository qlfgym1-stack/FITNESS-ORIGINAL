-- Seed admin user
-- Run this in Supabase SQL Editor after creating the user in Auth
-- 1. First create the user via Supabase Dashboard > Authentication > Add User
--    Email: MoussaMohamedelmabrouk@gmail.com
--    Password: (choose a strong password)
-- 2. Then run this script

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'MoussaMohamedelmabrouk@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found in auth.users. Create the user first via Supabase Dashboard > Authentication > Add User';
  END IF;

  -- Get or create the default organization
  INSERT INTO organizations (name, slug)
  VALUES ('DINATEK', 'dinatek')
  ON CONFLICT (slug) DO UPDATE SET name = 'DINATEK'
  RETURNING id INTO v_org_id;

  -- Assign super_admin role
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (v_user_id, v_org_id, 'super_admin')
  ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'super_admin';

  RAISE NOTICE 'Admin user MoussaMohamedelmabrouk@gmail.com assigned super_admin for organization DINATEK';
END $$;
