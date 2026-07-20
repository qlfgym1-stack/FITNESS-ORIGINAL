-- Coach salary history (monthly snapshots)
CREATE TABLE IF NOT EXISTS coach_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  fixed_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
  rate_per_member DECIMAL(10,2) NOT NULL DEFAULT 0,
  member_count INT NOT NULL DEFAULT 0,
  variable_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, period)
);

CREATE INDEX IF NOT EXISTS idx_coach_salary_history_coach_period
  ON coach_salary_history(coach_id, period DESC);

ALTER TABLE coach_salary_history ENABLE ROW LEVEL SECURITY;

-- Admins can manage all salary history
CREATE POLICY "admin_manage_coach_salary_history" ON coach_salary_history
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Coaches can view their own salary history
CREATE POLICY "coach_view_own_salary_history" ON coach_salary_history
  FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );
