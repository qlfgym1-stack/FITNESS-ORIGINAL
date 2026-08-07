-- Migration 00065: Accès RÉCEPTION — 2 comptes (rôle `receptionist`)
-- =============================================================================
-- Le rôle `receptionist` est restreint à /pointage, /members, /pos :
--   1. Lecture bloquée (RLS) sur les tables des autres modules
--   2. Écritures ciblées : members, member_subscriptions, attendance,
--      pos_sessions, pos_transactions, payments (INSERT uniquement)
--   3. RPC : checks élargis à (admin, receptionist) pour la création de membre,
--      la finalisation de paiement et le renouvellement ; decrement_product_stock
--      sécurisé (SECURITY DEFINER + rôle/org) ; garde d'appartenance à l'org sur
--      les RPCs check-in/RFID ; nouveau RPC get_staff_roster (liste coachs)
--   4. Traçabilité : attendance.created_by, pos_transactions.created_by,
--      user_id enregistré sur les check-ins
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper : le caller est-il membre de l'organisation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.organization_id = p_org_id
  )
$$;

-- ---------------------------------------------------------------------------
-- 1. Traçabilité : colonnes created_by
-- ---------------------------------------------------------------------------
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- =============================================================================
-- 2. Lecture BLOQUÉE pour `receptionist` sur les tables des autres modules
-- =============================================================================

-- 2.1 Tables basées sur organization_id (pattern "Staff can view X")
DROP POLICY IF EXISTS "Staff can view payments" ON payments;
CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payments.organization_id
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
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
        AND ur.role = 'receptionist'
    )
  );

-- 2.2 Tables en jointure / org via table parente

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
          AND ur2.role = 'receptionist'
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
          AND ur2.role = 'receptionist'
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
          AND ur.role = 'receptionist'
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
          AND ue2.role = 'receptionist'
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
          AND ur.role = 'receptionist'
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
          AND ur.role = 'receptionist'
    )
  );

-- =============================================================================
-- 3. Écritures autorisées pour `receptionist` (seulement sur les modules autorisés)
-- =============================================================================

-- members : INSERT (création membre) + UPDATE (édition, coach, RFID)
CREATE POLICY "Receptionists can insert members" ON members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = members.organization_id
        AND ur.role = 'receptionist'
    )
  );

CREATE POLICY "Receptionists can update members" ON members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = members.organization_id
        AND ur.role = 'receptionist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = members.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- member_subscriptions : INSERT + UPDATE (création membre, finalisation, renouvellement)
CREATE POLICY "Receptionists can insert member_subscriptions" ON member_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = member_subscriptions.organization_id
        AND ur.role = 'receptionist'
    )
  );

CREATE POLICY "Receptionists can update member_subscriptions" ON member_subscriptions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = member_subscriptions.organization_id
        AND ur.role = 'receptionist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = member_subscriptions.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- attendance : INSERT (pointage / drop-in) + UPDATE (check-out)
CREATE POLICY "Receptionists can insert attendance" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = attendance.organization_id
        AND ur.role = 'receptionist'
    )
  );

CREATE POLICY "Receptionists can update attendance" ON attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = attendance.organization_id
        AND ur.role = 'receptionist'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = attendance.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- pos_sessions : INSERT (ouverture de session au checkout)
CREATE POLICY "Receptionists can insert pos_sessions" ON pos_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = pos_sessions.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- pos_transactions : INSERT (vente)
CREATE POLICY "Receptionists can insert pos_transactions" ON pos_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = pos_transactions.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- payments : INSERT uniquement (enregistrement des encaissements abonnement) —
-- la lecture reste bloquée pour `receptionist` (module paiements interdit)
CREATE POLICY "Receptionists can insert payments" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = payments.organization_id
        AND ur.role = 'receptionist'
    )
  );

-- =============================================================================
-- 4. RPC : checks élargis à (admin, receptionist)
-- =============================================================================

-- 4.1 create_member_with_pending_subscription
CREATE OR REPLACE FUNCTION create_member_with_pending_subscription(
  p_organization_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_subscription_type_id UUID,
  p_start_date DATE,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_emergency_contact TEXT DEFAULT NULL,
  p_emergency_phone TEXT DEFAULT NULL,
  p_photo_url TEXT DEFAULT NULL,
  p_corporate_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_id UUID;
  v_subscription_id UUID;
  v_type subscription_types;
  v_end_date DATE;
BEGIN
  -- Authorization: admin ou réception de l'organisation
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can create subscriptions';
  END IF;

  INSERT INTO members (
    organization_id, first_name, last_name, email, phone, gender,
    birth_date, address, emergency_contact, emergency_phone, photo_url,
    status, last_visit, notes, corporate_id
  ) VALUES (
    p_organization_id, p_first_name, p_last_name, p_email, p_phone, p_gender,
    p_birth_date, p_address, p_emergency_contact, p_emergency_phone, p_photo_url,
    'active', NULL, NULL, p_corporate_id
  )
  RETURNING id INTO v_member_id;

  SELECT * INTO v_type
  FROM subscription_types
  WHERE id = p_subscription_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription type not found';
  END IF;

  v_end_date := p_start_date + (v_type.duration_days || ' days')::INTERVAL;

  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, v_member_id, p_subscription_type_id,
    p_start_date, v_end_date, v_type.price, 0, 'pending_payment'
  )
  RETURNING id INTO v_subscription_id;

  RETURN jsonb_build_object(
    'member_id', v_member_id,
    'subscription_id', v_subscription_id,
    'total_amount', v_type.price,
    'subscription_name', v_type.name,
    'organization_id', p_organization_id,
    'first_name', p_first_name,
    'last_name', p_last_name
  );
END;
$$;

-- 4.2 finalize_subscription_payment
CREATE OR REPLACE FUNCTION finalize_subscription_payment(
  p_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_payment_method TEXT,
  p_amount DECIMAL(10,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_sub member_subscriptions;
  v_payment_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can finalize payments';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_subscription_id
      AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Subscription does not belong to this organization';
  END IF;

  SELECT * INTO v_sub
  FROM member_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;

  IF v_sub.status != 'pending_payment' THEN
    RAISE EXCEPTION 'Subscription is not pending payment';
  END IF;

  UPDATE member_subscriptions
  SET status = 'active',
      amount_paid = p_amount
  WHERE id = p_subscription_id;

  INSERT INTO payments (
    organization_id, member_id, subscription_id, amount,
    payment_date, payment_method, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_id, p_amount,
    now(), p_payment_method, 'completed'
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', p_subscription_id,
    'payment_id', v_payment_id
  );
END;
$$;

-- 4.3 pay_and_renew (renouvellement abonnement au POS)
CREATE OR REPLACE FUNCTION pay_and_renew(
  p_old_subscription_id UUID,
  p_organization_id UUID,
  p_member_id UUID,
  p_subscription_type_id UUID,
  p_new_start_date DATE,
  p_new_end_date DATE,
  p_total_amount DECIMAL(10,2),
  p_payment_method TEXT,
  p_payment_amount DECIMAL(10,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_sub member_subscriptions;
  v_new_subscription_id UUID;
  v_payment_id UUID;
BEGIN
  -- Authorization: admin ou réception
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND organization_id = p_organization_id
      AND role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can renew subscriptions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM member_subscriptions
    WHERE id = p_old_subscription_id
      AND organization_id = p_organization_id
  ) THEN
    RAISE EXCEPTION 'Old subscription does not belong to this organization';
  END IF;

  SELECT * INTO v_old_sub
  FROM member_subscriptions
  WHERE id = p_old_subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Old subscription not found';
  END IF;

  IF v_old_sub.status NOT IN ('active', 'expired') THEN
    RAISE EXCEPTION 'Old subscription must be active or expired to renew (current status: %)', v_old_sub.status;
  END IF;

  UPDATE member_subscriptions
  SET status = 'expired'
  WHERE id = p_old_subscription_id;

  INSERT INTO member_subscriptions (
    organization_id, member_id, subscription_type_id,
    start_date, end_date, total_amount, amount_paid, status
  ) VALUES (
    p_organization_id, p_member_id, p_subscription_type_id,
    p_new_start_date, p_new_end_date, p_total_amount, p_payment_amount, 'active'
  )
  RETURNING id INTO v_new_subscription_id;

  INSERT INTO payments (
    organization_id, member_id, subscription_id, amount,
    payment_date, payment_method, status
  ) VALUES (
    p_organization_id, p_member_id, v_new_subscription_id, p_payment_amount,
    now(), p_payment_method, 'completed'
  )
  RETURNING id INTO v_payment_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_subscription_id', v_new_subscription_id,
    'payment_id', v_payment_id
  );
END;
$$;

-- 4.4 decrement_product_stock : sécurisé (SECURITY DEFINER + rôle/org)
CREATE OR REPLACE FUNCTION decrement_product_stock(p_id UUID, p_qty INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM products WHERE id = p_id;
  IF v_org IS NULL THEN
    RETURN FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.organization_id = v_org
      AND ur.role IN ('admin', 'receptionist')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: only admin or receptionist can decrement stock';
  END IF;
  UPDATE products
  SET stock = stock - p_qty
  WHERE id = p_id AND stock >= p_qty;
  RETURN FOUND;
END;
$$;

-- 4.5 get_staff_roster : liste des coachs (id, prénom, nom) — évite d'exposer
--     les salaires (`staff` est bloqué en lecture pour la réception)
CREATE OR REPLACE FUNCTION get_staff_roster(p_org_id uuid)
RETURNS TABLE (id uuid, first_name text, last_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_org_member(p_org_id) THEN
    RAISE EXCEPTION 'Unauthorized: not a member of this organization';
  END IF;
  RETURN QUERY
    SELECT s.id, s.first_name, s.last_name
    FROM staff s
    WHERE s.organization_id = p_org_id
      AND s.is_active = true
    ORDER BY s.first_name;
END;
$$;

-- =============================================================================
-- 5. RPCs check-in : garde d'appartenance à l'org + traçabilité auth.uid()
-- =============================================================================

-- 5.1 rfid_check_in
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

  -- Garde : le caller doit être membre de l'organisation du membre
  IF NOT is_org_member(v_organization_id) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Accès non autorisé');
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
    INSERT INTO attendance (organization_id, member_id, check_in, type, source, created_by)
      VALUES (v_organization_id, v_member_id, NOW(), 'check-in', 'rfid', auth.uid())
      RETURNING id INTO v_attendance_id;
    UPDATE members SET last_visit = NOW() WHERE id = v_member_id;
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, user_id)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'granted', auth.uid());
    RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id, 'member_id', v_member_id);
  ELSE
    INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason, user_id)
      VALUES (p_card_uid, v_member_id, p_terminal, 'check-in', 'pending', 'Turnstile ' || v_turnstile_status, auth.uid());
    RETURN jsonb_build_object('result', 'pending', 'reason', 'Tourniquet ' || v_turnstile_status, 'member_id', v_member_id);
  END IF;
END;
$$;

-- 5.2 rfid_check_out
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
  v_org uuid;
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

  SELECT organization_id INTO v_org FROM members WHERE id = v_member_id;
  IF v_org IS NULL OR NOT is_org_member(v_org) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Accès non autorisé');
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

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, user_id)
    VALUES (p_card_uid, v_member_id, p_terminal, 'check-out', 'granted', auth.uid());
  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;

-- 5.3 phone_check_in
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
  -- Garde : le caller doit être membre de l'organisation
  IF NOT is_org_member(p_org_id) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Accès non autorisé');
  END IF;

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
    INSERT INTO attendance (member_id, organization_id, check_in, created_by)
    VALUES (v_member_id, p_org_id, now(), auth.uid());

    RETURN jsonb_build_object(
      'result', 'granted',
      'action', 'check_in',
      'member_id', v_member_id,
      'member_name', v_member_name
    );
  END IF;
END;
$$;

-- 5.4 manual_check_in
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

  -- Garde : le caller doit être membre de l'organisation du membre
  IF NOT is_org_member(v_organization_id) THEN
    RETURN jsonb_build_object('result', 'denied', 'reason', 'Accès non autorisé');
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
    UPDATE attendance SET check_out = NOW() WHERE id = v_active_attendance_id;
  END IF;

  INSERT INTO attendance (organization_id, member_id, check_in, type, source, created_by)
    VALUES (v_organization_id, p_member_id, NOW(), 'check-in', 'manual', auth.uid())
    RETURNING id INTO v_attendance_id;

  INSERT INTO manual_validations (organization_id, member_id, user_id, reason, reason_detail, terminal)
    VALUES (v_organization_id, p_member_id, p_user_id, p_reason, p_reason_detail, p_terminal);

  INSERT INTO rfid_read_logs (card_uid, member_id, terminal, event_type, result, reason, user_id)
    VALUES ('manual', p_member_id, COALESCE(p_terminal, 'kiosk'), 'check-in', 'granted', 'Validation manuelle: ' || p_reason, auth.uid());

  UPDATE members SET last_visit = NOW() WHERE id = p_member_id;

  RETURN jsonb_build_object('result', 'granted', 'attendance_id', v_attendance_id);
END;
$$;
