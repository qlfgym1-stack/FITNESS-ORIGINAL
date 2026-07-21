CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'produits', 'materiel', 'travaux', 'amenagement', 'logiciels',
    'marketing', 'publicite', 'formation', 'autres'
  )),
  description TEXT NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  investment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "investments_admin_all" ON investments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.organization_id = investments.organization_id
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "investments_staff_read" ON investments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.organization_id = investments.organization_id
      AND user_roles.role IN ('staff', 'coach')
    )
  );

CREATE INDEX idx_investments_org ON investments(organization_id);
CREATE INDEX idx_investments_category ON investments(category);
CREATE INDEX idx_investments_date ON investments(investment_date);

CREATE TABLE IF NOT EXISTS profitability_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly')),
  period_label TEXT NOT NULL,
  revenue_target DECIMAL(12,2) DEFAULT 0,
  profit_target DECIMAL(12,2) DEFAULT 0,
  investment_budget DECIMAL(12,2) DEFAULT 0,
  member_target INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, period_type, period_label)
);

ALTER TABLE profitability_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objectives_admin_all" ON profitability_objectives
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.organization_id = profitability_objectives.organization_id
      AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "objectives_staff_read" ON profitability_objectives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.organization_id = profitability_objectives.organization_id
      AND user_roles.role IN ('staff', 'coach')
    )
  );

CREATE INDEX idx_objectives_org ON profitability_objectives(organization_id);
