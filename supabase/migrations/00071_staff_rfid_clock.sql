-- 00071: Staff RFID clock-in/out → auto-fill timesheet
-- Scans staff.rfid_uid, creates/updates staff_timesheet rows automatically

CREATE OR REPLACE FUNCTION staff_rfid_clock(p_rfid_uid TEXT)
RETURNS JSON AS $$
DECLARE
  v_staff RECORD;
  v_today DATE := CURRENT_DATE;
  v_existing RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lookup active staff by rfid_uid
  SELECT id, first_name, last_name, organization_id
  INTO v_staff
  FROM staff
  WHERE rfid_uid = p_rfid_uid AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('result', 'not_found', 'reason', 'Badge inconnu');
  END IF;

  -- 2. Check existing timesheet entry for today
  SELECT * INTO v_existing
  FROM staff_timesheet
  WHERE staff_id = v_staff.id
    AND date = v_today
    AND organization_id = v_staff.organization_id;

  IF v_existing IS NULL THEN
    -- No entry → CLOCK IN
    INSERT INTO staff_timesheet (staff_id, organization_id, date, clock_in)
    VALUES (v_staff.id, v_staff.organization_id, v_today, v_now);
    RETURN json_build_object(
      'result', 'granted',
      'action', 'clock_in',
      'staff_name', v_staff.first_name || ' ' || v_staff.last_name,
      'staff_id', v_staff.id
    );
  ELSIF v_existing.clock_in IS NOT NULL AND v_existing.clock_out IS NULL THEN
    -- Has clock_in but no clock_out → CLOCK OUT
    UPDATE staff_timesheet
    SET clock_out = v_now,
        total_hours = ROUND(EXTRACT(EPOCH FROM (v_now - v_existing.clock_in)) / 3600, 2)
    WHERE id = v_existing.id;
    RETURN json_build_object(
      'result', 'granted',
      'action', 'clock_out',
      'staff_name', v_staff.first_name || ' ' || v_staff.last_name,
      'staff_id', v_staff.id,
      'total_hours', ROUND(EXTRACT(EPOCH FROM (v_now - v_existing.clock_in)) / 3600, 2)
    );
  ELSE
    -- Already clocked in AND out → done
    RETURN json_build_object(
      'result', 'already_done',
      'reason', 'Pointage déjà terminé pour aujourd''hui',
      'staff_name', v_staff.first_name || ' ' || v_staff.last_name
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
