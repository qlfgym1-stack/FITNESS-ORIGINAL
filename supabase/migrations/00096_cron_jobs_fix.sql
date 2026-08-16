-- Fix cron job URLs: replace SUPABASE_PROJECT_REF placeholder with the real project ref
-- (00004 created these jobs with the placeholder, so they pointed to
-- https://SUPABASE_PROJECT_REF.supabase.co/functions/v1/... which always failed.)
--
-- The Authorization header uses the service_role key stored in Supabase Vault
-- (created as 'service_role_key') because the GUC supabase.service_role_key is
-- not available on this project's cron connections.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-subscription-reminder') THEN
    PERFORM cron.unschedule('send-subscription-reminder');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-payment-reminder') THEN
    PERFORM cron.unschedule('send-payment-reminder');
  END IF;
END $$;

-- Notify about expiring subscriptions daily at 8:00 AM
SELECT cron.schedule(
  'send-subscription-reminder',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgxisgmfnkxwdkchfneb.supabase.co/functions/v1/send-subscription-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  ) AS request_id;
  $$
);

-- Notify about pending payments daily at 9:00 AM
SELECT cron.schedule(
  'send-payment-reminder',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgxisgmfnkxwdkchfneb.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    )
  ) AS request_id;
  $$
);
