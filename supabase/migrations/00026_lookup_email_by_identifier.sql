-- RPC: lookup email by identifier (member_number, phone) without auth context
-- SECURITY DEFINER: runs as owner, bypasses RLS to enable pre-auth lookup
CREATE OR REPLACE FUNCTION lookup_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
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

  -- Fallback to staff
  SELECT email INTO v_email
  FROM staff
  WHERE phone = p_identifier
     OR email = p_identifier
  LIMIT 1;

  RETURN v_email;
END;
$$;
