-- Anti-fraude RFID : refuser le check-in si un check-in actif existe déjà
-- Au lieu d'auto-checkouter silencieusement l'ancienne session

-- 1. rfid_check_in : deny instead of auto-checkout
CREATE OR REPLACE FUNCTION rfid_check_in(
  p_card_uid TEXT,
  p_terminal TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_organization_id UUID;
  v_card_status TEXT;
  v_member_status TEXT;
  v_last_read TIMESTAMPTZ;
  v_active_attendance_id UUID;
  v_turnstile_status TEXT;
  v_attendance_id UUID;
BEGIN
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Debounce: carte déjà scannée il y a moins de 3 secondes');
  END IF;

  SELECT member_id, status INTO v_member_id, v_card_status
    FROM rfid_cards
    WHERE rfid_uid = p_card_uid
    FOR UPDATE;
  IF v_card_status IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte non trouvée');
  END IF;
  IF v_card_status != 'ACTIF' THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Badge invalide');
  END IF;

  SELECT organization_id, status INTO v_organization_id, v_member_status
    FROM members
    WHERE id = v_member_id
    FOR UPDATE;
  IF v_member_status IN ('suspended', 'blocked', 'inactive') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Membre ' || v_member_status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE member_id = v_member_id
      AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Abonnement inexistant ou expiré');
  END IF;

  SELECT id INTO v_active_attendance_id
    FROM attendance
    WHERE member_id = v_member_id
      AND check_in IS NOT NULL
      AND check_out IS NULL
      AND type = 'check-in'
    LIMIT 1;
  IF v_active_attendance_id IS NOT NULL THEN
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'denied', 'Check-in déjà actif. Veuillez faire un check-out d''abord.');
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Check-in déjà actif. Veuillez faire un check-out d''abord.');
  END IF;

  SELECT status INTO v_turnstile_status
    FROM turnstile_status
    WHERE organization_id = v_organization_id AND terminal = p_terminal;
  IF v_turnstile_status IS NULL OR v_turnstile_status = 'online' THEN
    INSERT INTO attendance (organization_id, member_id, check_in, type, source)
      VALUES (v_organization_id, v_member_id, NOW(), 'check-in', 'rfid')
      RETURNING id INTO v_attendance_id;
    UPDATE members SET last_visit = NOW() WHERE id = v_member_id;
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'granted');
    RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id, 'member_id', v_member_id);
  ELSE
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'pending', 'Turnstile ' || v_turnstile_status);
    RETURN jsonb_build_object('result', 'pending', 'reason', 'Tourniquet ' || v_turnstile_status, 'member_id', v_member_id);
  END IF;
END;
$$;

-- 2. manual_check_in : deny instead of auto-checkout
CREATE OR REPLACE FUNCTION manual_check_in(
  p_member_id UUID,
  p_user_id UUID,
  p_reason TEXT,
  p_terminal TEXT DEFAULT NULL,
  p_reason_detail TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_organization_id UUID;
  v_member_status TEXT;
  v_active_attendance_id UUID;
  v_attendance_id UUID;
BEGIN
  IF p_reason NOT IN ('breakdown', 'maintenance', 'emergency', 'test', 'other') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Motif invalide');
  END IF;

  SELECT organization_id, status INTO v_organization_id, v_member_status
    FROM members WHERE id = p_member_id FOR UPDATE;
  IF v_member_status IN ('suspended', 'blocked', 'inactive') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Membre ' || v_member_status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE member_id = p_member_id
      AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Abonnement inexistant ou expiré');
  END IF;

  SELECT id INTO v_active_attendance_id
    FROM attendance
    WHERE member_id = p_member_id
      AND check_in IS NOT NULL
      AND check_out IS NULL
      AND type = 'check-in'
    LIMIT 1;
  IF v_active_attendance_id IS NOT NULL THEN
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
      VALUES ('manual', p_member_id, COALESCE(p_terminal, 'kiosk'), 'check-in', 'denied', 'Check-in déjà actif. Veuillez faire un check-out d''abord.');
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Check-in déjà actif. Veuillez faire un check-out d''abord.');
  END IF;

  INSERT INTO attendance (organization_id, member_id, check_in, type, source)
    VALUES (v_organization_id, p_member_id, NOW(), 'check-in', 'manual')
    RETURNING id INTO v_attendance_id;

  INSERT INTO manual_validations (organization_id, member_id, user_id, reason, reason_detail, terminal)
    VALUES (v_organization_id, p_member_id, p_user_id, p_reason, p_reason_detail, p_terminal);

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
    VALUES ('manual', p_member_id, COALESCE(p_terminal, 'kiosk'), 'check-in', 'granted', 'Validation manuelle: ' || p_reason);

  UPDATE members SET last_visit = NOW() WHERE id = p_member_id;

  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;
