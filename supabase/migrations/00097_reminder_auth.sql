-- Auth helper for Edge Functions called by pg_cron with a service_role JWT.
-- The platform-injected SUPABASE_SERVICE_ROLE_KEY is the new sb_secret_... format,
-- which cannot be string-compared to a legacy service_role JWT. Instead the EFs
-- validate the incoming bearer token against the key stored in Supabase Vault
-- (name 'service_role_key', created via the Management API).

create or replace function public.is_valid_service_role(p_token text)
returns boolean
language sql
security definer
set search_path = public, vault
stable
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'service_role_key'
      and decrypted_secret = p_token
  );
$$;

revoke execute on function public.is_valid_service_role(text) from public;
grant execute on function public.is_valid_service_role(text) to authenticated, service_role;
