-- Edge Function Cron Schedules
-- Requires pg_cron and pg_net extensions
-- After deploying, replace SUPABASE_PROJECT_REF with your project reference
-- or use the Supabase Dashboard: Database → Cron

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Notify about expiring subscriptions daily at 8:00 AM
SELECT cron.schedule(
  'send-subscription-reminder',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SUPABASE_PROJECT_REF.supabase.co/functions/v1/send-subscription-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
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
    url := 'https://SUPABASE_PROJECT_REF.supabase.co/functions/v1/send-payment-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    )
  ) AS request_id;
  $$
);
