-- Staff Shifts (referenced in types/supabase.ts)
CREATE TABLE staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage staff_shifts" ON staff_shifts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid()
          AND organization_id = staff_shifts.organization_id
          AND role IN ('admin', 'super_admin')
      )
  );

CREATE POLICY "Staff can view staff_shifts" ON staff_shifts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_date ON staff_shifts(date);
