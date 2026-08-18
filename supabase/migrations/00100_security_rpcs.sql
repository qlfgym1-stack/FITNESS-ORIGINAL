-- ============================================================================
-- Migration 00100: Security fixes for SECURITY DEFINER RPCs
-- Fix 1: get_dashboard_stats — caller must belong to the requested org
-- Fix 2: assign_admin_role_by_email — restricted to service_role only
-- Fix 3: RFID management RPCs — caller must be admin in the member's org
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- Fix 1: get_dashboard_stats — add org membership check
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  -- Verify caller is member of the requested organization
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = p_organization_id
    AND role IN ('admin', 'staff', 'coach')
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

  SELECT jsonb_build_object(
    'total_members', (SELECT COUNT(*) FROM members WHERE organization_id = p_organization_id),
    'active_members', (SELECT COUNT(*) FROM members WHERE organization_id = p_organization_id AND status = 'active'),
    'inactive_members', (SELECT COUNT(*) FROM members WHERE organization_id = p_organization_id AND status = 'inactive'),
    'total_classes', (SELECT COUNT(*) FROM classes WHERE organization_id = p_organization_id),
    'today_checkins', (SELECT COUNT(*) FROM attendance WHERE organization_id = p_organization_id AND check_in::date = CURRENT_DATE),
    'monthly_revenue', COALESCE((SELECT SUM(amount) FROM payments WHERE organization_id = p_organization_id AND status = 'completed' AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0),
    'last_month_revenue', COALESCE((SELECT SUM(amount) FROM payments WHERE organization_id = p_organization_id AND status = 'completed' AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0),
    'expiring_subscriptions', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT ms.id, ms.end_date, ms.status,
               m.first_name || ' ' || m.last_name AS member_name,
               st.name AS type_name
        FROM member_subscriptions ms
        JOIN members m ON m.id = ms.member_id
        JOIN subscription_types st ON st.id = ms.subscription_type_id
        WHERE ms.organization_id = p_organization_id
          AND ms.status = 'active'
          AND ms.end_date <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY ms.end_date ASC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'recent_payments', COALESCE((
      SELECT jsonb_agg(row_to_json(t))
      FROM (
        SELECT p.id, p.amount, p.payment_date, p.payment_method, p.status,
               m.first_name || ' ' || m.last_name AS member_name
        FROM payments p
        JOIN members m ON m.id = p.member_id
        WHERE p.organization_id = p_organization_id
        ORDER BY p.payment_date DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'revenue_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', to_char(d, 'Mon'), 'amount', COALESCE(SUM(p.amount), 0)))
      FROM generate_series(CURRENT_DATE - INTERVAL '5 months', CURRENT_DATE, '1 month') d
      LEFT JOIN payments p ON DATE_TRUNC('month', p.payment_date) = DATE_TRUNC('month', d)
        AND p.organization_id = p_organization_id
        AND p.status = 'completed'
      GROUP BY d ORDER BY d
    ), '[]'::jsonb),
    'growth_trend', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('month', to_char(d, 'Mon'), 'count', COUNT(m.id)))
      FROM generate_series(CURRENT_DATE - INTERVAL '5 months', CURRENT_DATE, '1 month') d
      LEFT JOIN members m ON DATE_TRUNC('month', m.created_at) = DATE_TRUNC('month', d)
        AND m.organization_id = p_organization_id
      GROUP BY d ORDER BY d
    ), '[]'::jsonb),
    'gender_data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', g.gender, 'value', g.cnt, 'color', CASE WHEN g.gender = 'Male' THEN '#3b82f6' ELSE '#ec4899' END))
      FROM (
        SELECT CASE
                 WHEN LOWER(gender) IN ('male', 'm') THEN 'Male'
                 WHEN LOWER(gender) IN ('female', 'f') THEN 'Female'
                 ELSE 'Other'
               END AS gender,
               COUNT(*) AS cnt
        FROM members
        WHERE organization_id = p_organization_id
        GROUP BY 1
      ) g
      WHERE g.gender IN ('Male', 'Female') AND g.cnt > 0
    ), '[]'::jsonb),
    'recent_activity', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t."timestamp" DESC)
      FROM (
        SELECT 'a-' || a.id AS id, 'Check-in' AS action,
               m.first_name || ' ' || m.last_name AS member,
               a.check_in AS "timestamp", 'log-in' AS icon
        FROM attendance a
        JOIN members m ON m.id = a.member_id
        WHERE a.organization_id = p_organization_id
        UNION ALL
        SELECT 'p-' || p.id AS id, 'Payment received' AS action,
               m.first_name || ' ' || m.last_name AS member,
               p.payment_date AS "timestamp", 'dollar' AS icon
        FROM payments p
        JOIN members m ON m.id = p.member_id
        WHERE p.organization_id = p_organization_id
      ) t
      ORDER BY t."timestamp" DESC
      LIMIT 10
    ), '[]'::jsonb),
    'top_coaches', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name, 'classes', cc.cnt, 'specialty', 'Staff'))
      FROM (
        SELECT coach_id, COUNT(id) AS cnt
        FROM classes
        WHERE organization_id = p_organization_id AND coach_id IS NOT NULL
        GROUP BY coach_id
        ORDER BY cnt DESC
        LIMIT 5
      ) cc
      JOIN staff s ON s.id = cc.coach_id
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- Fix 2: assign_admin_role_by_email — restrict to service_role only
-- ──────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION assign_admin_role_by_email(text, text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION assign_admin_role_by_email(text, text) TO service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- Fix 3: RFID management RPCs — add admin role check per organization
-- ──────────────────────────────────────────────────────────────────────────────

-- 3a: assign_rfid_card (has p_member_id → look up org from member)
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
  v_org_id UUID;
BEGIN
  -- Verify caller has admin role in the member's organization
  SELECT organization_id INTO v_org_id FROM members WHERE id = p_member_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = v_org_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

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

-- 3b: replace_rfid_card (has p_member_id → look up org from member)
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
  v_org_id UUID;
BEGIN
  -- Verify caller has admin role in the member's organization
  SELECT organization_id INTO v_org_id FROM members WHERE id = p_member_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = v_org_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

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

-- 3c: deactivate_rfid_card (no p_member_id → look up org from card → member)
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
  v_org_id UUID;
BEGIN
  -- Look up card and member, then verify admin role
  SELECT rc.id, rc.member_id, m.organization_id
    INTO v_card_id, v_member_id, v_org_id
    FROM rfid_cards rc
    JOIN members m ON m.id = rc.member_id
    WHERE rc.rfid_uid = p_rfid_uid;
  IF v_card_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Badge RFID non trouvé');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = v_org_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  UPDATE rfid_cards SET status = 'DÉSACTIVÉ', updated_at = now() WHERE id = v_card_id;

  INSERT INTO rfid_audit_log (member_id, old_rfid_uid, new_rfid_uid, action, reason, notes, created_by)
    VALUES (v_member_id, p_rfid_uid, p_rfid_uid, 'DEACTIVATE', p_reason, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3d: reactivate_rfid_card (no p_member_id → look up org from card → member)
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
  v_org_id UUID;
BEGIN
  -- Look up card and member, then verify admin role
  SELECT rc.id, rc.member_id, m.organization_id
    INTO v_card_id, v_member_id, v_org_id
    FROM rfid_cards rc
    JOIN members m ON m.id = rc.member_id
    WHERE rc.rfid_uid = p_rfid_uid;
  IF v_card_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Badge RFID non trouvé');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = v_org_id
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
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

-- 3e: check_rfid_available (no p_member_id → look up org from card → member)
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
  v_org_id UUID;
BEGIN
  SELECT rc.status, rc.member_id, CONCAT(m.first_name, ' ', m.last_name), m.organization_id
    INTO v_status, v_member_id, v_member_name, v_org_id
    FROM rfid_cards rc
    LEFT JOIN members m ON m.id = rc.member_id
    WHERE rc.rfid_uid = p_rfid_uid;

  -- Verify caller has a role in this card's organization
  IF v_org_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND organization_id = v_org_id
      AND role IN ('admin', 'staff', 'coach')
    ) THEN
      RAISE EXCEPTION 'Access denied: not a member of this organization';
    END IF;
  END IF;

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

-- 3f: get_member_rfid_history (has p_member_id → look up org from member)
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
  v_org_id UUID;
BEGIN
  -- Verify caller has a role in the member's organization
  SELECT organization_id INTO v_org_id FROM members WHERE id = p_member_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND organization_id = v_org_id
    AND role IN ('admin', 'staff', 'coach')
  ) THEN
    RAISE EXCEPTION 'Access denied: not a member of this organization';
  END IF;

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
