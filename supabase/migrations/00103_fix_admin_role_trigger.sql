-- Fix: replace trigger that still uses deprecated 'super_admin' role
-- Original trigger (00001) inserted 'super_admin'; migration 00059 replaced the
-- function but the original trigger name was 'after_organization_insert'.
-- This migration is a safety net: re-creates both function and trigger atomically.

CREATE OR REPLACE FUNCTION public.auto_assign_owner_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), NEW.id, 'admin');
  RETURN NEW;
END;
$$;

-- Drop the old trigger (named 'after_organization_insert' in 00001) and recreate
DROP TRIGGER IF EXISTS after_organization_insert ON public.organizations;
CREATE TRIGGER after_organization_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_owner_role();
