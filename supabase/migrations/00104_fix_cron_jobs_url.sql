-- Fix cron jobs: replace SUPABASE_PROJECT_REF with actual project ref
-- and re-enable with correct URLs

-- Remove old broken cron jobs if they exist
SELECT cron.unschedule('send-subscription-reminder');
SELECT cron.unschedule('send-payment-reminder');

-- Re-enable subscription reminder daily at 8:00 AM
SELECT cron.schedule(
  'send-subscription-reminder',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgxisgmfnkxwdkchfneb.supabase.co/functions/v1/send-subscription-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    )
  ) AS request_id;
  $$
);

-- Re-enable payment reminder daily at 9:00 AM
SELECT cron.schedule(
  'send-payment-reminder',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qgxisgmfnkxwdkchfneb.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    )
  ) AS request_id;
  $$
);
