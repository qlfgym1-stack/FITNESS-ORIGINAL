-- RFID Toggle : au lieu de refuser quand un check-in actif existe,
-- effectuer automatiquement le check-out

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
  v_member_name TEXT;
BEGIN
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Debounce: carte déjà scannée il y a moins de 3 secondes');
  END IF;

  SELECT rc.member_id, rc.status INTO v_member_id, v_card_status
    FROM rfid_cards rc
    WHERE rc.rfid_uid = p_card_uid
    FOR UPDATE;
  IF v_card_status IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte non trouvée');
  END IF;
  IF v_card_status != 'ACTIF' THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Badge invalide');
  END IF;

  SELECT m.organization_id, m.status, m.first_name || ' ' || m.last_name
    INTO v_organization_id, v_member_status, v_member_name
    FROM members m
    WHERE m.id = v_member_id
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
    UPDATE attendance SET check_out = NOW() WHERE id = v_active_attendance_id;
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-out', 'granted');
    RETURN jsonb_build_object(
      'result', 'granted',
      'action', 'check_out',
      'attendance_id', v_active_attendance_id,
      'member_id', v_member_id,
      'member_name', v_member_name
    );
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
    RETURN jsonb_build_object('result', 'granted', 'action', 'check_in', 'attendance_id', v_attendance_id, 'member_id', v_member_id, 'member_name', v_member_name);
  ELSE
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'pending', 'Turnstile ' || v_turnstile_status);
    RETURN jsonb_build_object('result', 'pending', 'reason', 'Tourniquet ' || v_turnstile_status, 'member_id', v_member_id);
  END IF;
END;
$$;
