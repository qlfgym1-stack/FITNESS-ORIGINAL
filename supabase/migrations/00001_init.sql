-- FitManager Pro - Initial Schema
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Roles (Supabase Auth integration)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin', 'coach', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- Members
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  birth_date DATE,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  photo_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_visit TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription Types
CREATE TABLE subscription_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  max_classes INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Member Subscriptions
CREATE TABLE member_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_type_id UUID NOT NULL REFERENCES subscription_types(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES member_subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  salary DECIMAL(10,2),
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  coach_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INT,
  color TEXT DEFAULT '#6366f1',
  recurring BOOLEAN DEFAULT false,
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Class Enrollments
CREATE TABLE class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'attended')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, member_id)
);

-- Attendance
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  type TEXT DEFAULT 'check-in' CHECK (type IN ('check-in', 'class')),
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff Timesheet
CREATE TABLE staff_timesheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_hours DECIMAL(5,2),
  notes TEXT
);

-- Staff Leaves
CREATE TABLE staff_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vacation', 'sick', 'personal')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  quantity INT DEFAULT 1,
  available_quantity INT DEFAULT 1,
  status TEXT,
  purchase_date DATE,
  last_maintenance TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Equipment Reservations
CREATE TABLE equipment_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity INT DEFAULT 0,
  unit TEXT,
  min_stock INT,
  price DECIMAL(10,2),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  quantity INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  order_date TIMESTAMPTZ DEFAULT now(),
  status TEXT,
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- POS Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock INT,
  image_url TEXT,
  barcode TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- POS Sessions
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  total DECIMAL(10,2)
);

-- POS Transactions
CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES pos_sessions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  payment_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Member Badges
CREATE TABLE member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, badge_id)
);

-- Access Control Devices
CREATE TABLE access_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('turnstile', 'door', 'barrier')),
  device_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Access Logs
CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_control_id UUID NOT NULL REFERENCES access_control(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('granted', 'denied')),
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,
  type TEXT,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Settings (key-value)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, key)
);

-- Corporate Accounts
CREATE TABLE corporate (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  discount_rate DECIMAL(5,2),
  contract_start DATE,
  contract_end DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student Verifications
CREATE TABLE student_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  school_name TEXT NOT NULL,
  student_id TEXT,
  document_url TEXT,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Wedding Programs
CREATE TABLE wedding_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_days INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  max_participants INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_members_org ON members(organization_id);
CREATE INDEX idx_subscriptions_org ON member_subscriptions(organization_id);
CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_attendance_org ON attendance(organization_id);
CREATE INDEX idx_attendance_date ON attendance(check_in);
CREATE INDEX idx_member_subscriptions_member ON member_subscriptions(member_id);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_classes_org ON classes(organization_id);
CREATE INDEX idx_staff_org ON staff(organization_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_org ON notifications(organization_id);

-- Auto-assign super_admin role when an organization is created
CREATE OR REPLACE FUNCTION auto_assign_owner_role()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_roles (user_id, organization_id, role)
  VALUES (auth.uid(), NEW.id, 'super_admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_organization_insert
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_owner_role();

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_timesheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access their organization's data
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage members" ON members
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = members.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view members" ON members
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage member_subscriptions" ON member_subscriptions
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = member_subscriptions.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view member_subscriptions" ON member_subscriptions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: user_roles — users see their own roles
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert staff role" ON user_roles
  FOR INSERT WITH CHECK (user_id = auth.uid() AND role IN ('staff', 'coach'));

-- RLS: subscription_types
CREATE POLICY "Admins can manage subscription_types" ON subscription_types
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = subscription_types.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view subscription_types" ON subscription_types
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: payments
CREATE POLICY "Admins can manage payments" ON payments
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = payments.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view payments" ON payments
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: classes
CREATE POLICY "Admins can manage classes" ON classes
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = classes.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view classes" ON classes
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: class_enrollments (via classes)
CREATE POLICY "Admins can manage class_enrollments" ON class_enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes
        JOIN user_roles ON user_roles.organization_id = classes.organization_id
        WHERE classes.id = class_enrollments.class_id
          AND user_roles.user_id = auth.uid()
          AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Staff can view class_enrollments" ON class_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes
        JOIN user_roles ON user_roles.organization_id = classes.organization_id
        WHERE classes.id = class_enrollments.class_id
          AND user_roles.user_id = auth.uid()
    )
  );

-- RLS: attendance
CREATE POLICY "Admins can manage attendance" ON attendance
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = attendance.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view attendance" ON attendance
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: staff
CREATE POLICY "Admins can manage staff" ON staff
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = staff.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view staff" ON staff
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: staff_timesheet
CREATE POLICY "Admins can manage staff_timesheet" ON staff_timesheet
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = staff_timesheet.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view staff_timesheet" ON staff_timesheet
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: staff_leaves
CREATE POLICY "Admins can manage staff_leaves" ON staff_leaves
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = staff_leaves.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view staff_leaves" ON staff_leaves
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: equipment
CREATE POLICY "Admins can manage equipment" ON equipment
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = equipment.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view equipment" ON equipment
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: equipment_reservations
CREATE POLICY "Admins can manage equipment_reservations" ON equipment_reservations
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = equipment_reservations.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view equipment_reservations" ON equipment_reservations
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: inventory
CREATE POLICY "Admins can manage inventory" ON inventory
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = inventory.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view inventory" ON inventory
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: stock_movements
CREATE POLICY "Admins can manage stock_movements" ON stock_movements
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = stock_movements.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view stock_movements" ON stock_movements
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: suppliers
CREATE POLICY "Admins can manage suppliers" ON suppliers
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = suppliers.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view suppliers" ON suppliers
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: purchase_orders
CREATE POLICY "Admins can manage purchase_orders" ON purchase_orders
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = purchase_orders.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view purchase_orders" ON purchase_orders
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: products
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = products.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view products" ON products
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: pos_sessions
CREATE POLICY "Admins can manage pos_sessions" ON pos_sessions
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = pos_sessions.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view pos_sessions" ON pos_sessions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: pos_transactions
CREATE POLICY "Admins can manage pos_transactions" ON pos_transactions
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = pos_transactions.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view pos_transactions" ON pos_transactions
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: badges
CREATE POLICY "Admins can manage badges" ON badges
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = badges.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view badges" ON badges
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: member_badges (via badges)
CREATE POLICY "Admins can manage member_badges" ON member_badges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM badges
        JOIN user_roles ON user_roles.organization_id = badges.organization_id
        WHERE badges.id = member_badges.badge_id
          AND user_roles.user_id = auth.uid()
          AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Staff can view member_badges" ON member_badges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM badges
        JOIN user_roles ON user_roles.organization_id = badges.organization_id
        WHERE badges.id = member_badges.badge_id
          AND user_roles.user_id = auth.uid()
    )
  );

-- RLS: access_control
CREATE POLICY "Admins can manage access_control" ON access_control
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = access_control.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view access_control" ON access_control
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: access_logs (via access_control)
CREATE POLICY "Users can view access_logs in their org" ON access_logs
  FOR SELECT USING (
    access_control_id IN (SELECT id FROM access_control WHERE organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid()))
  );

-- RLS: notifications — service_role can insert, users view their own
CREATE POLICY "Service role can insert notifications" ON notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- RLS: licenses
CREATE POLICY "Admins can manage licenses" ON licenses
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = licenses.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view licenses" ON licenses
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: settings
CREATE POLICY "Admins can manage settings" ON settings
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = settings.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view settings" ON settings
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: corporate
CREATE POLICY "Admins can manage corporate" ON corporate
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = corporate.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view corporate" ON corporate
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: student_verifications
CREATE POLICY "Admins can manage student_verifications" ON student_verifications
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = student_verifications.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view student_verifications" ON student_verifications
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- RLS: wedding_programs
CREATE POLICY "Admins can manage wedding_programs" ON wedding_programs
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = wedding_programs.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view wedding_programs" ON wedding_programs
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
