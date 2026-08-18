-- Rate limiting for lookup_email_by_identifier (HIGH security fix)
-- Max 10 lookups per IP per 15 minutes

CREATE TABLE IF NOT EXISTS lookup_rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address inet NOT NULL,
  attempt_count int DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lookup_rate_limits_ip ON lookup_rate_limits(ip_address, window_start);

ALTER TABLE lookup_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow service_role (Edge Functions) to manage rate limits
CREATE POLICY "Service role can manage lookup rate limits"
  ON lookup_rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION lookup_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_active BOOLEAN;
BEGIN
  -- Rate limit: max 10 lookups per IP per 15 minutes
  IF (SELECT count(*) FROM lookup_rate_limits WHERE ip_address = inet_client_addr() AND window_start > now() - interval '15 minutes') > 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again later.';
  END IF;

  -- Record this attempt
  INSERT INTO lookup_rate_limits (ip_address) VALUES (inet_client_addr());

  -- Cleanup old entries (older than 1 hour)
  DELETE FROM lookup_rate_limits WHERE window_start < now() - interval '1 hour';

  -- Search members first
  SELECT email INTO v_email
  FROM members
  WHERE member_number = p_identifier
     OR phone = p_identifier
     OR email = p_identifier
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    RETURN v_email;
  END IF;

  -- Fallback to staff (phone, email, or username)
  SELECT email, is_active INTO v_email, v_active
  FROM staff
  WHERE phone = p_identifier
     OR email = p_identifier
     OR username = LOWER(p_identifier)
  LIMIT 1;

  IF v_email IS NOT NULL THEN
    IF NOT v_active THEN
      RETURN 'INACTIVE_ACCOUNT';
    END IF;
    RETURN v_email;
  END IF;

  RETURN NULL;
END;
$$;
