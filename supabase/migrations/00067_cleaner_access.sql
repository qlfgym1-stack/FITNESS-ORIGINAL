-- Migration 00067: Accès MÉNAGE (rôle `cleaner`) — lecture seule sur /pointage
-- =============================================================================
-- Le rôle `cleaner` (ménage) est restreint à /pointage en lecture seule :
--   1. Lecture bloquée (RLS) sur les mêmes tables que la réception (~25 tables)
--   2. Aucune écriture : les policies INSERT/UPDATE sont réservées admin/réception
--   3. RPC : le ménage ne peut PAS effectuer de check-in/out (réutilisation de
--      `is_org_member` → exclut désormais le rôle `cleaner`)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper : le caller est-il membre de l'organisation (hors ménage) ?
--    Utilisé comme garde dans les RPC check-in/roster — le ménage est exclu.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = p_org_id
      AND ur.role != 'cleaner'
  )
$$;

-- =============================================================================
-- 1. Lecture BLOQUÉE pour `cleaner` sur les tables des autres modules
--    (même liste que la réception — la garde exclut désormais les 2 rôles)
-- =============================================================================

-- 1.1 Tables basées sur organization_id (pattern "Staff can view X")
DROP POLICY IF EXISTS "Staff can view payments" ON payments;
CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payments.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view classes" ON classes;
CREATE POLICY "Staff can view classes" ON classes
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = classes.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view staff" ON staff;
CREATE POLICY "Staff can view staff" ON staff
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = staff.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view staff_timesheet" ON staff_timesheet;
CREATE POLICY "Staff can view staff_timesheet" ON staff_timesheet
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = staff_timesheet.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view staff_leaves" ON staff_leaves;
CREATE POLICY "Staff can view staff_leaves" ON staff_leaves
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = staff_leaves.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view equipment" ON equipment;
CREATE POLICY "Staff can view equipment" ON equipment
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = equipment.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view equipment_reservations" ON equipment_reservations;
CREATE POLICY "Staff can view equipment_reservations" ON equipment_reservations
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = equipment_reservations.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view inventory" ON inventory;
CREATE POLICY "Staff can view inventory" ON inventory
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = inventory.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view stock_movements" ON stock_movements;
CREATE POLICY "Staff can view stock_movements" ON stock_movements
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = stock_movements.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view suppliers" ON suppliers;
CREATE POLICY "Staff can view suppliers" ON suppliers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = suppliers.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view purchase_orders" ON purchase_orders;
CREATE POLICY "Staff can view purchase_orders" ON purchase_orders
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = purchase_orders.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view badges" ON badges;
CREATE POLICY "Staff can view badges" ON badges
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = badges.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view access_control" ON access_control;
CREATE POLICY "Staff can view access_control" ON access_control
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = access_control.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view licenses" ON licenses;
CREATE POLICY "Staff can view licenses" ON licenses
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = licenses.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view settings" ON settings;
CREATE POLICY "Staff can view settings" ON settings
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = settings.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view student_verifications" ON student_verifications;
CREATE POLICY "Staff can view student_verifications" ON student_verifications
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = student_verifications.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view wedding_programs" ON wedding_programs;
CREATE POLICY "Staff can view wedding_programs" ON wedding_programs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = wedding_programs.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view expenses" ON expenses;
CREATE POLICY "Staff can view expenses" ON expenses
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = expenses.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view staff_shifts" ON staff_shifts;
CREATE POLICY "Staff can view staff_shifts" ON staff_shifts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = staff_shifts.organization_id
        AND ur.role IN ('receptionist', 'cleaner')
    )
  );

-- 1.2 Tables en jointure / org via table parente

DROP POLICY IF EXISTS "Staff can view class_enrollments" ON class_enrollments;
CREATE POLICY "Staff can view class_enrollments" ON class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
        JOIN user_roles ur ON ur.organization_id = c.organization_id
        WHERE c.id = class_enrollments.class_id
          AND ur.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM classes c2
        JOIN user_roles ur2 ON ur2.organization_id = c2.organization_id
        WHERE c2.id = class_enrollments.class_id
          AND ur2.user_id = auth.uid()
          AND ur2.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Staff can view member_badges" ON member_badges;
CREATE POLICY "Staff can view member_badges" ON member_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM badges b
        JOIN user_roles ur ON ur.organization_id = b.organization_id
        WHERE b.id = member_badges.badge_id
          AND ur.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM badges b2
        JOIN user_roles ur2 ON ur2.organization_id = b2.organization_id
        WHERE b2.id = member_badges.badge_id
          AND ur2.user_id = auth.uid()
          AND ur2.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Users can view access_logs in their org" ON access_logs;
CREATE POLICY "Users can view access_logs in their org" ON access_logs
  FOR SELECT USING (
    access_control_id IN (
      SELECT id FROM access_control
      WHERE organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM access_control ac
        JOIN user_roles ur ON ur.organization_id = ac.organization_id
        WHERE ac.id = access_logs.access_control_id
          AND ur.user_id = auth.uid()
          AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Users can view rfid_read_logs" ON rfid_read_logs;
CREATE POLICY "Users can view rfid_read_logs" ON rfid_read_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ue
        JOIN members m ON m.id = rfid_read_logs.member_id
        WHERE ue.user_id = auth.uid()
          AND ue.organization_id = m.organization_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ue2
        JOIN members m2 ON m2.id = rfid_read_logs.member_id
        WHERE ue2.user_id = auth.uid()
          AND ue2.organization_id = m2.organization_id
          AND ue2.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Users can view turnstile_status" ON turnstile_status;
CREATE POLICY "Users can view turnstile_status" ON turnstile_status
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ue
        WHERE ue.user_id = auth.uid()
          AND ue.organization_id = turnstile_status.organization_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = turnstile_status.organization_id
          AND ur.role IN ('receptionist', 'cleaner')
    )
  );

DROP POLICY IF EXISTS "Users can view manual_validations" ON manual_validations;
CREATE POLICY "Users can view manual_validations" ON manual_validations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ue
        WHERE ue.user_id = auth.uid()
          AND ue.organization_id = manual_validations.organization_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.organization_id = manual_validations.organization_id
          AND ur.role IN ('receptionist', 'cleaner')
    )
  );

-- =============================================================================
-- 2. Ménage = aucun droit d'écriture (déjà garanti par les policies RLS)
--    INSERT/UPDATE sur members / member_subscriptions / attendance /
--    pos_sessions / pos_transactions / payments → réservés à `receptionist`.
--    Le ménage ne passe aucune policy d'écriture (lecture seule).
-- =============================================================================
