-- Missing FK indexes for better query performance
-- (existing indexes were added in 00001_init.sql)

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org ON user_roles(organization_id);

-- subscription_types
CREATE INDEX IF NOT EXISTS idx_subscription_types_org ON subscription_types(organization_id);

-- member_subscriptions (subscription_type_id missing)
CREATE INDEX IF NOT EXISTS idx_member_subscriptions_type ON member_subscriptions(subscription_type_id);

-- classes (coach_id missing)
CREATE INDEX IF NOT EXISTS idx_classes_coach ON classes(coach_id);

-- class_enrollments
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_member ON class_enrollments(member_id);

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);

-- staff
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);

-- staff_timesheet
CREATE INDEX IF NOT EXISTS idx_staff_timesheet_staff ON staff_timesheet(staff_id);

-- staff_leaves
CREATE INDEX IF NOT EXISTS idx_staff_leaves_staff ON staff_leaves(staff_id);

-- equipment
CREATE INDEX IF NOT EXISTS idx_equipment_org ON equipment(organization_id);

-- equipment_reservations
CREATE INDEX IF NOT EXISTS idx_equip_reservations_equip ON equipment_reservations(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equip_reservations_member ON equipment_reservations(member_id);

-- inventory
CREATE INDEX IF NOT EXISTS idx_inventory_supplier ON inventory(supplier_id);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory ON stock_movements(inventory_id);

-- suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);

-- purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);

-- products
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);

-- pos_sessions
CREATE INDEX IF NOT EXISTS idx_pos_sessions_staff ON pos_sessions(staff_id);

-- pos_transactions
CREATE INDEX IF NOT EXISTS idx_pos_transactions_session ON pos_transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_member ON pos_transactions(member_id);

-- badges
CREATE INDEX IF NOT EXISTS idx_badges_org ON badges(organization_id);

-- member_badges
CREATE INDEX IF NOT EXISTS idx_member_badges_member ON member_badges(member_id);
CREATE INDEX IF NOT EXISTS idx_member_badges_badge ON member_badges(badge_id);

-- access_control
CREATE INDEX IF NOT EXISTS idx_access_control_org ON access_control(organization_id);

-- access_logs
CREATE INDEX IF NOT EXISTS idx_access_logs_device ON access_logs(access_control_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_member ON access_logs(member_id);

-- licenses
CREATE INDEX IF NOT EXISTS idx_licenses_org ON licenses(organization_id);

-- settings
CREATE INDEX IF NOT EXISTS idx_settings_org ON settings(organization_id);

-- corporate
CREATE INDEX IF NOT EXISTS idx_corporate_org ON corporate(organization_id);

-- student_verifications
CREATE INDEX IF NOT EXISTS idx_student_verifications_member ON student_verifications(member_id);

-- wedding_programs
CREATE INDEX IF NOT EXISTS idx_wedding_programs_org ON wedding_programs(organization_id);

-- payments (subscription_id missing)
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id);
