CREATE OR REPLACE FUNCTION verify_recovery_code(p_email TEXT, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_code_hash TEXT;
  v_computed_hash TEXT;
  v_count BIGINT;
  v_since TIMESTAMPTZ;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email);

  IF v_user_id IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid credentials');
  END IF;

  -- Rate limiting: max 5 failed attempts per 15 minutes
  v_since := now() - interval '15 minutes';
  SELECT count(*) INTO v_count
  FROM recovery_code_logs
  WHERE user_id = v_user_id
    AND success = false
    AND attempted_at >= v_since;

  IF v_count >= 5 THEN
    RETURN json_build_object('valid', false, 'error', 'Too many attempts. Try again later.');
  END IF;

  -- Get stored hash
  SELECT code_hash INTO v_code_hash
  FROM recovery_codes
  WHERE user_id = v_user_id;

  IF v_code_hash IS NULL THEN
    INSERT INTO recovery_code_logs (user_id, success) VALUES (v_user_id, false);
    RETURN json_build_object('valid', false, 'error', 'Invalid credentials');
  END IF;

  -- Hash submitted code and compare (constant-time via digest)
  v_computed_hash := encode(digest(upper(p_code), 'sha256'), 'hex');

  IF length(v_computed_hash) <> length(v_code_hash) THEN
    INSERT INTO recovery_code_logs (user_id, success) VALUES (v_user_id, false);
    RETURN json_build_object('valid', false, 'error', 'Invalid credentials');
  END IF;

  -- Constant-time comparison
  IF NOT (v_computed_hash = v_code_hash) THEN
    INSERT INTO recovery_code_logs (user_id, success) VALUES (v_user_id, false);
    RETURN json_build_object('valid', false, 'error', 'Invalid credentials');
  END IF;

  -- Log successful attempt
  INSERT INTO recovery_code_logs (user_id, success) VALUES (v_user_id, true);

  -- Update last_used_at
  UPDATE recovery_codes SET last_used_at = now() WHERE user_id = v_user_id;

  RETURN json_build_object('valid', true, 'user_id', v_user_id);
END;
$$;
