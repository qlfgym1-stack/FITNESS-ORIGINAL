CREATE TABLE IF NOT EXISTS staff_salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'check')),
  period TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage salary payments" ON staff_salary_payments
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = staff_salary_payments.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view own salary payments" ON staff_salary_payments
  FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE INDEX idx_staff_salary_payments_staff_period ON staff_salary_payments(staff_id, period DESC);
CREATE INDEX idx_staff_salary_payments_org ON staff_salary_payments(organization_id);
