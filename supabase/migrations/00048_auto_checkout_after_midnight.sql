-- Auto-close all open attendances from before today
-- Called by pg_cron at midnight + frontend on page load as safety net
CREATE OR REPLACE FUNCTION auto_close_stale_attendances()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_closed INT;
BEGIN
  UPDATE attendance
  SET check_out = check_in + INTERVAL '1 hour'
  WHERE check_out IS NULL
    AND check_in < CURRENT_DATE
    AND type = 'check-in';

  GET DIAGNOSTICS v_closed = ROW_COUNT;

  RETURN jsonb_build_object(
    'closed', v_closed,
    'timestamp', NOW()
  );
END;
$$;

-- Cron: run every day at 00:01 to auto-close yesterday's open check-ins
SELECT cron.schedule(
  'auto-close-midnight',
  '1 0 * * *',
  $$SELECT auto_close_stale_attendances();$$
);
