-- Drop RPCs that depend on rfid_cards
DROP FUNCTION IF EXISTS rfid_check_in(TEXT, TEXT);
DROP FUNCTION IF EXISTS rfid_check_out(TEXT, TEXT);

-- Drop existing policies on rfid_cards
DROP POLICY IF EXISTS "Staff can view rfid_cards" ON rfid_cards;
DROP POLICY IF EXISTS "Admins can manage rfid_cards" ON rfid_cards;

-- Drop indexes
DROP INDEX IF EXISTS idx_rfid_cards_card_uid;
DROP INDEX IF EXISTS idx_rfid_cards_member_id;

-- Recreate rfid_cards with new schema
DROP TABLE IF EXISTS rfid_cards;

CREATE TABLE rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rfid_uid TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIF'
    CHECK (status IN ('ACTIF', 'REMPLACÉ', 'DÉSACTIVÉ', 'PERDU', 'VOLÉ', 'BLACKLISTÉ', 'ARCHIVÉ')),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  replaced_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES rfid_cards(id) ON DELETE SET NULL,
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rfid_cards_member ON rfid_cards(member_id);
CREATE INDEX idx_rfid_cards_status ON rfid_cards(status);

-- RFID audit log
CREATE TABLE IF NOT EXISTS rfid_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  old_rfid_uid TEXT,
  new_rfid_uid TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('ASSIGN', 'REPLACE', 'DEACTIVATE', 'REACTIVATE', 'ARCHIVE')),
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rfid_audit_log_member ON rfid_audit_log(member_id);
CREATE INDEX idx_rfid_audit_log_created ON rfid_audit_log(created_at);

-- RLS
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view rfid_cards" ON rfid_cards FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)));

CREATE POLICY "Admins can manage rfid_cards" ON rfid_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

CREATE POLICY "Staff can view rfid_audit_log" ON rfid_audit_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)));

CREATE POLICY "Admins can manage rfid_audit_log" ON rfid_audit_log FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

-- RPC: assign_rfid_card
CREATE OR REPLACE FUNCTION assign_rfid_card(
  p_member_id UUID,
  p_rfid_uid TEXT,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_id UUID;
  v_existing_status TEXT;
BEGIN
  -- Check RFID not already used by another member with ACTIF status
  SELECT status INTO v_existing_status FROM rfid_cards WHERE rfid_uid = p_rfid_uid LIMIT 1;
  IF v_existing_status IS NOT NULL AND v_existing_status IN ('ACTIF', 'REMPLACÉ', 'DÉSACTIVÉ', 'PERDU', 'VOLÉ', 'BLACKLISTÉ') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce badge RFID est déjà attribué à un autre adhérent');
  END IF;

  -- Insert new card
  INSERT INTO rfid_cards (member_id, rfid_uid, status, reason, notes, created_by)
    VALUES (p_member_id, p_rfid_uid, 'ACTIF', p_reason, p_notes, p_created_by)
    RETURNING id INTO v_card_id;

  -- Audit log
  INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, reason, notes, created_by)
    VALUES (p_member_id, NULL, p_rfid_uid, 'ASSIGN', p_reason, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true, 'card_id', v_card_id);
END;
$$;

-- RPC: replace_rfid_card
CREATE OR REPLACE FUNCTION replace_rfid_card(
  p_member_id UUID,
  p_old_rfid_uid TEXT,
  p_new_rfid_uid TEXT,
  p_reason TEXT DEFAULT 'Autre',
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_card_id UUID;
  v_new_card_id UUID;
  v_existing_status TEXT;
BEGIN
  -- Validate reason
  IF p_reason NOT IN ('Badge perdu', 'Badge volé', 'Badge endommagé', 'Badge illisible', 'Changement administratif', 'Autre') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif invalide');
  END IF;
  IF p_reason = 'Autre' AND (p_notes IS NULL OR p_notes = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commentaire obligatoire pour le motif "Autre"');
  END IF;

  -- Check new RFID not already used
  SELECT status INTO v_existing_status FROM rfid_cards WHERE rfid_uid = p_new_rfid_uid LIMIT 1;
  IF v_existing_status IS NOT NULL AND v_existing_status IN ('ACTIF', 'REMPLACÉ', 'DÉSACTIVÉ', 'PERDU', 'VOLÉ', 'BLACKLISTÉ') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce badge RFID est déjà attribué à un autre adhérent');
  END IF;

  -- Get old card id
  SELECT id INTO v_old_card_id FROM rfid_cards WHERE rfid_uid = p_old_rfid_uid AND member_id = p_member_id;
  IF v_old_card_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ancien badge non trouvé pour cet adhérent');
  END IF;

  -- Mark old card as REMPLACÉ
  UPDATE rfid_cards SET
    status = 'REMPLACÉ',
    replaced_at = now(),
    notes = CASE WHEN notes IS NULL THEN p_reason ELSE notes || ' | ' || p_reason END,
    updated_at = now()
    WHERE id = v_old_card_id;

  -- Insert new card
  INSERT INTO rfid_cards (member_id, rfid_uid, status, replaced_by, reason, notes, created_by)
    VALUES (p_member_id, p_new_rfid_uid, 'ACTIF', v_old_card_id, p_reason, p_notes, p_created_by)
    RETURNING id INTO v_new_card_id;

  -- Audit log
  INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, reason, notes, created_by)
    VALUES (p_member_id, p_old_rfid_uid, p_new_rfid_uid, 'REPLACE', p_reason, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true, 'old_card_id', v_old_card_id, 'new_card_id', v_new_card_id);
END;
$$;

-- RPC: deactivate_rfid_card
CREATE OR REPLACE FUNCTION deactivate_rfid_card(
  p_rfid_uid TEXT,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_id UUID;
  v_member_id UUID;
BEGIN
  SELECT id, member_id INTO v_card_id, v_member_id FROM rfid_cards WHERE rfid_uid = p_rfid_uid;
  IF v_card_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Badge RFID non trouvé');
  END IF;

  UPDATE rfid_cards SET status = 'DÉSACTIVÉ', updated_at = now() WHERE id = v_card_id;

  INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, reason, notes, created_by)
    VALUES (v_member_id, p_rfid_uid, p_rfid_uid, 'DEACTIVATE', p_reason, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: reactivate_rfid_card
CREATE OR REPLACE FUNCTION reactivate_rfid_card(
  p_rfid_uid TEXT,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_card_id UUID;
  v_member_id UUID;
  v_member_active TEXT;
BEGIN
  SELECT id, member_id INTO v_card_id, v_member_id FROM rfid_cards WHERE rfid_uid = p_rfid_uid;
  IF v_card_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Badge RFID non trouvé');
  END IF;

  -- Check another ACTIF card doesn't already exist for this member
  SELECT status INTO v_member_active FROM rfid_cards
    WHERE member_id = v_member_id AND status = 'ACTIF' AND rfid_uid != p_rfid_uid LIMIT 1;
  IF v_member_active IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Un badge ACTIF existe déjà pour cet adhérent. Remplacez-le plutôt.');
  END IF;

  UPDATE rfid_cards SET status = 'ACTIF', updated_at = now() WHERE id = v_card_id;

  INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, reason, notes, created_by)
    VALUES (v_member_id, p_rfid_uid, p_rfid_uid, 'REACTIVATE', p_reason, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- RPC: check_rfid_available
CREATE OR REPLACE FUNCTION check_rfid_available(
  p_rfid_uid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
  v_member_id UUID;
  v_member_name TEXT;
BEGIN
  SELECT rc.status, rc.member_id, CONCAT(m.first_name, ' ', m.last_name)
    INTO v_status, v_member_id, v_member_name
    FROM rfid_cards rc
    LEFT JOIN members m ON m.id = rc.member_id
    WHERE rc.rfid_uid = p_rfid_uid;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('available', true);
  END IF;

  RETURN jsonb_build_object(
    'available', false,
    'status', v_status,
    'member_id', v_member_id,
    'member_name', v_member_name
  );
END;
$$;

-- RPC: get_member_rfid_history
CREATE OR REPLACE FUNCTION get_member_rfid_history(
  p_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cards JSONB;
  v_audit JSONB;
  v_active JSONB;
BEGIN
  -- Active card
  SELECT jsonb_build_object(
    'id', id, 'rfid_uid', rfid_uid, 'status', status,
    'assigned_at', assigned_at, 'reason', reason, 'notes', notes
  ) INTO v_active
  FROM rfid_cards
  WHERE member_id = p_member_id AND status = 'ACTIF'
  LIMIT 1;

  -- All cards (history)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'rfid_uid', rfid_uid, 'status', status,
    'assigned_at', assigned_at, 'replaced_at', replaced_at,
    'reason', reason, 'notes', notes
  ) ORDER BY assigned_at DESC), '[]'::jsonb) INTO v_cards
  FROM rfid_cards
  WHERE member_id = p_member_id;

  -- Audit log
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'old_rfid_uid', old_rfid_uid,
    'new_rfid_uid', new_rfid_uid, 'action', action,
    'reason', reason, 'notes', notes, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_audit
  FROM rfid_audit_log
  WHERE member_id = p_member_id;

  RETURN jsonb_build_object(
    'active_card', v_active,
    'cards', v_cards,
    'audit_log', v_audit
  );
END;
$$;

-- Recreate rfid_check_in with new column names
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
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Debounce: carte déjà scannée il y a moins de 3 secondes');
  END IF;

  -- Use rfid_uid (new column name) to match the card
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
    UPDATE attendance SET check_out = NOW() WHERE id = v_active_attendance_id;
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

-- Recreate rfid_check_out with new column names
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
  SELECT MAX(read_at) INTO v_last_read
    FROM rfid_read_logs
    WHERE card_uid = p_card_uid
      AND event_type = 'check-out'
      AND result = 'granted'
      AND read_at > NOW() - INTERVAL '3 seconds';
  IF v_last_read IS NOT NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Debounce: check-out déjà effectué');
  END IF;

  SELECT member_id INTO v_member_id FROM rfid_cards WHERE rfid_uid = p_card_uid;
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Carte non trouvée');
  END IF;

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

  UPDATE attendance SET check_out = NOW() WHERE id = v_attendance_id;
  UPDATE members SET last_visit = NOW() WHERE id = v_member_id;

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result)
    VALUES (p_card_uid, v_member_id, p_terminal, 'check-out', 'granted');
  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;
