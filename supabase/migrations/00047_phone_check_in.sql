CREATE OR REPLACE FUNCTION phone_check_in(p_phone TEXT, p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id UUID;
  v_member_name TEXT;
  v_has_active_sub BOOLEAN;
  v_existing RECORD;
BEGIN
  SELECT m.id, m.first_name || ' ' || m.last_name
  INTO v_member_id, v_member_name
  FROM members m
  WHERE m.organization_id = p_org_id
    AND m.phone IS NOT NULL
    AND REPLACE(REPLACE(REPLACE(REPLACE(m.phone, ' ', ''), '-', ''), '.', ''), '+', '')
      LIKE '%' || REPLACE(REPLACE(REPLACE(REPLACE(p_phone, ' ', ''), '-', ''), '.', ''), '+', '') || '%'
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object(
      'result', 'denied',
      'reason', 'Aucun membre trouvé avec ce numéro'
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM member_subscriptions ms
    WHERE ms.member_id = v_member_id
      AND ms.organization_id = p_org_id
      AND ms.status IN ('active', 'trial')
      AND (ms.end_date IS NULL OR ms.end_date >= CURRENT_DATE)
  ) INTO v_has_active_sub;

  IF NOT v_has_active_sub THEN
    RETURN jsonb_build_object(
      'result', 'denied',
      'reason', 'Aucun abonnement actif',
      'member_id', v_member_id,
      'member_name', v_member_name
    );
  END IF;

  SELECT id, check_in, check_out
  INTO v_existing
  FROM attendance
  WHERE member_id = v_member_id
    AND organization_id = p_org_id
    AND check_in::date = CURRENT_DATE
    AND check_out IS NULL
  ORDER BY check_in DESC
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE attendance
    SET check_out = now()
    WHERE id = v_existing.id;

    RETURN jsonb_build_object(
      'result', 'granted',
      'action', 'check_out',
      'member_id', v_member_id,
      'member_name', v_member_name
    );
  ELSE
    INSERT INTO attendance (member_id, organization_id, check_in)
    VALUES (v_member_id, p_org_id, now());

    RETURN jsonb_build_object(
      'result', 'granted',
      'action', 'check_in',
      'member_id', v_member_id,
      'member_name', v_member_name
    );
  END IF;
END;
$$;
