CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('rent', 'salaries', 'electricity', 'water', 'equipment', 'maintenance', 'marketing', 'insurance', 'taxes', 'other')),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage expenses" ON expenses
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = expenses.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view expenses" ON expenses
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE INDEX idx_expenses_organization_id ON expenses(organization_id);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
