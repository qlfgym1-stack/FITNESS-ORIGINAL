-- Extend members status to include suspended and blocked
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'blocked'));

-- rfid_cards: link a physical card UID to a member
CREATE TABLE IF NOT EXISTS rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  card_uid TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost', 'stolen', 'expired')),
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- rfid_read_logs: every scan event for audit
CREATE TABLE IF NOT EXISTS rfid_read_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid TEXT NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  terminal TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('check-in', 'check-out', 'denied')),
  result TEXT NOT NULL CHECK (result IN ('granted', 'denied', 'pending')),
  reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ DEFAULT now()
);

-- turnstile_status: real-time heartbeats per terminal
CREATE TABLE IF NOT EXISTS turnstile_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  terminal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'fault')),
  last_heartbeat TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, terminal)
);

-- manual_validations: staff overrides when turnstile is down
CREATE TABLE IF NOT EXISTS manual_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('breakdown', 'maintenance', 'emergency', 'test', 'other')),
  reason_detail TEXT,
  terminal TEXT,
  validated_at TIMESTAMPTZ DEFAULT now()
);

-- Extend attendance with source tracking and optional access_control reference
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rfid'
    CHECK (source IN ('rfid', 'manual', 'app'));
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS access_control_id UUID
    REFERENCES access_control(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rfid_cards_card_uid ON rfid_cards(card_uid);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_member_id ON rfid_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_rfid_read_logs_card_uid ON rfid_read_logs(card_uid);
CREATE INDEX IF NOT EXISTS idx_rfid_read_logs_read_at ON rfid_read_logs(read_at);
CREATE INDEX IF NOT EXISTS idx_turnstile_status_org ON turnstile_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_validations_org ON manual_validations(organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_validations_date ON manual_validations(validated_at);
CREATE INDEX IF NOT EXISTS idx_attendance_source ON attendance(source);

-- RLS: rfid_cards
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view rfid_cards" ON rfid_cards FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)));
CREATE POLICY "Admins can manage rfid_cards" ON rfid_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

-- RLS: rfid_read_logs
ALTER TABLE rfid_read_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rfid_read_logs" ON rfid_read_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue JOIN members m ON m.id = rfid_read_logs.member_id
    WHERE ue.user_id = auth.uid() AND ue.organization_id = m.organization_id));
CREATE POLICY "Admins can manage rfid_read_logs" ON rfid_read_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

-- RLS: turnstile_status
ALTER TABLE turnstile_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view turnstile_status" ON turnstile_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = turnstile_status.organization_id));
CREATE POLICY "Admins can manage turnstile_status" ON turnstile_status FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = turnstile_status.organization_id
    AND ue.role IN ('admin', 'super_admin')));

-- RLS: manual_validations
ALTER TABLE manual_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view manual_validations" ON manual_validations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = manual_validations.organization_id));
CREATE POLICY "Staff can insert manual_validations" ON manual_validations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id = manual_validations.organization_id
    AND ue.role IN ('admin', 'super_admin', 'staff')));

-- RPC: rfid_check_in — atomic check-in with fraud prevention
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
  v_card_expires TIMESTAMPTZ;
  v_last_read TIMESTAMPTZ;
  v_active_attendance_id UUID;
  v_turnstile_status TEXT;
  v_attendance_id UUID;
BEGIN
  -- 1. Debounce: skip if same card read < 3 seconds ago
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object(
      'result', 'denied',
      'reason', 'Debounce: carte déjà scannée il y a moins de 3 secondes'
    );
  END IF;

  -- 2. Lock card row and verify status
  SELECT member_id, status, expires_at INTO v_member_id, v_card_status, v_card_expires
    FROM rfid_cards
    WHERE card_uid = p_card_uid
    FOR UPDATE;
  IF v_card_status IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte non trouvée');
  END IF;
  IF v_card_status != 'active' THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte ' || v_card_status);
  END IF;
  IF v_card_expires IS NOT NULL AND v_card_expires < NOW() THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte expirée');
  END IF;

  -- 3. Lock member row and verify status
  SELECT organization_id, status INTO v_organization_id, v_member_status
    FROM members
    WHERE id = v_member_id
    FOR UPDATE;
  IF v_member_status IN ('suspended', 'blocked', 'inactive') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Membre ' || v_member_status);
  END IF;

  -- 4. Verify active subscription
  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE member_id = v_member_id
      AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Abonnement inexistant ou expiré');
  END IF;

  -- 5. Check no active check-in without check-out
  SELECT id INTO v_active_attendance_id
    FROM attendance
    WHERE member_id = v_member_id
      AND check_in IS NOT NULL
      AND check_out IS NULL
      AND type = 'check-in'
    LIMIT 1;
  IF v_active_attendance_id IS NOT NULL THEN
    -- Auto check-out the old session, then proceed with check-in
    UPDATE attendance SET check_out = NOW() WHERE id = v_active_attendance_id;
  END IF;

  -- 6. Check turnstile status
  SELECT status INTO v_turnstile_status
    FROM turnstile_status
    WHERE organization_id = v_organization_id
      AND terminal = p_terminal;
  IF v_turnstile_status IS NULL OR v_turnstile_status = 'online' THEN
    -- Online: create attendance immediately
    INSERT INTO attendance (organization_id, member_id, check_in, type, source)
      VALUES (v_organization_id, v_member_id, NOW(), 'check-in', 'rfid')
      RETURNING id INTO v_attendance_id;
    UPDATE members SET last_visit = NOW() WHERE id = v_member_id;
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'granted');
    RETURN jsonb_build_object(
      'result', 'granted',
      'attendance_id', v_attendance_id,
      'member_id', v_member_id
    );
  ELSE
    -- Offline/Fault: return pending, no attendance created
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'pending', 'Turnstile ' || v_turnstile_status);
    RETURN jsonb_build_object(
      'result', 'pending',
      'reason', 'Tourniquet ' || v_turnstile_status,
      'member_id', v_member_id
    );
  END IF;
END;
$$;

-- RPC: rfid_check_out — record check-out and free the member
CREATE OR REPLACE FUNCTION rfid_check_out(
  p_card_uid TEXT,
  p_terminal TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_attendance_id UUID;
  v_last_read TIMESTAMPTZ;
BEGIN
  -- Debounce 3s
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND event_type = 'check-out'
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Debounce: check-out déjà effectué');
  END IF;

  -- Find member by card
  SELECT member_id INTO v_member_id FROM rfid_cards WHERE card_uid = p_card_uid;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte non trouvée');
  END IF;

  -- Find active attendance
  SELECT id INTO v_attendance_id
    FROM attendance
    WHERE member_id = v_member_id
      AND check_in IS NOT NULL
      AND check_out IS NULL
      AND type = 'check-in'
    ORDER BY check_in DESC
    LIMIT 1
    FOR UPDATE;
  IF v_attendance_id IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Aucun check-in actif');
  END IF;

  -- Update check-out
  UPDATE attendance SET check_out = NOW() WHERE id = v_attendance_id;
  UPDATE members SET last_visit = NOW() WHERE id = v_member_id;

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result)
    VALUES (p_card_uid, v_member_id, p_terminal, 'check-out', 'granted');
  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;

-- RPC: manual_check_in — staff override for turnstile breakdown
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
  -- Validate reason
  IF p_reason NOT IN ('breakdown', 'maintenance', 'emergency', 'test', 'other') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Motif invalide');
  END IF;

  -- Lock member and check status
  SELECT organization_id, status INTO v_organization_id, v_member_status
    FROM members WHERE id = p_member_id FOR UPDATE;
  IF v_member_status IN ('suspended', 'blocked', 'inactive') THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Membre ' || v_member_status);
  END IF;

  -- Verify active subscription
  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE member_id = p_member_id
      AND status = 'active'
      AND start_date <= CURRENT_DATE
      AND end_date >= CURRENT_DATE
  ) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Abonnement inexistant ou expiré');
  END IF;

  -- Check no active check-in
  SELECT id INTO v_active_attendance_id
    FROM attendance
    WHERE member_id = p_member_id
      AND check_in IS NOT NULL
      AND check_out IS NULL
      AND type = 'check-in'
    LIMIT 1;
  IF v_active_attendance_id IS NOT NULL THEN
    UPDATE attendance SET check_out = NOW() WHERE id = v_active_attendance_id;
  END IF;

  -- Create attendance
  INSERT INTO attendance (organization_id, member_id, check_in, type, source)
    VALUES (v_organization_id, p_member_id, NOW(), 'check-in', 'manual')
    RETURNING id INTO v_attendance_id;

  -- Log manual validation
  INSERT INTO manual_validations (organization_id, member_id, user_id, reason, reason_detail, terminal)
    VALUES (v_organization_id, p_member_id, p_user_id, p_reason, p_reason_detail, p_terminal);

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason)
    VALUES ('manual', p_member_id, COALESCE(p_terminal, 'kiosk'), 'check-in', 'granted', 'Validation manuelle: ' || p_reason);

  UPDATE members SET last_visit = NOW() WHERE id = p_member_id;

  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;

-- RPC: turnstile_heartbeat — upsert turnstile status from hardware
CREATE OR REPLACE FUNCTION turnstile_heartbeat(
  p_organization_id UUID,
  p_terminal TEXT,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO turnstile_status (organization_id, terminal, status, last_heartbeat)
    VALUES (p_organization_id, p_terminal, p_status, NOW())
    ON CONFLICT (organization_id, terminal)
    DO UPDATE SET status = p_status, last_heartbeat = NOW(), updated_at = NOW();
  RETURN jsonb_build_object('result', 'ok');
END;
$$;

-- RPC: get_turnstile_dashboard — aggregated stats for dashboard widgets
CREATE OR REPLACE FUNCTION get_turnstile_dashboard(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_online INT;
  v_offline INT;
  v_fault INT;
  v_manual_today INT;
  v_manual_total INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM turnstile_status WHERE organization_id = p_organization_id;
  SELECT COUNT(*) INTO v_online FROM turnstile_status WHERE organization_id = p_organization_id AND status = 'online';
  SELECT COUNT(*) INTO v_offline FROM turnstile_status WHERE organization_id = p_organization_id AND status = 'offline';
  SELECT COUNT(*) INTO v_fault FROM turnstile_status WHERE organization_id = p_organization_id AND status = 'fault';
  SELECT COUNT(*) INTO v_manual_today FROM manual_validations WHERE organization_id = p_organization_id AND validated_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_manual_total FROM manual_validations WHERE organization_id = p_organization_id;

  RETURN jsonb_build_object(
    'total_terminals', v_total,
    'online', v_online,
    'offline', v_offline,
    'fault', v_fault,
    'manual_validations_today', v_manual_today,
    'manual_validations_total', v_manual_total
  );
END;
$$;
