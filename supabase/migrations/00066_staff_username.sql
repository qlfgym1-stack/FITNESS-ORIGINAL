-- Staff username-based login (additive, existing accounts unaffected)
-- Column username on staff + global unique index
ALTER TABLE staff ADD COLUMN IF NOT EXISTS username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS staff_username_unique_idx ON staff (username) WHERE username IS NOT NULL;

-- Extend pre-auth lookup RPC:
--   - username matching (case-insensitive)
--   - require is_active = true
--   - sentinel 'INACTIVE_ACCOUNT' so the client can show a clear message
CREATE OR REPLACE FUNCTION lookup_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_active BOOLEAN;
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
