ALTER TABLE members ADD COLUMN coach_id UUID REFERENCES staff(id) ON DELETE SET NULL;
CREATE INDEX idx_members_coach_id ON members(coach_id);

-- RLS policy : coach voit uniquement les membres qui lui sont assignés
DROP POLICY IF EXISTS "coach_select_own_members" ON members;
CREATE POLICY "coach_select_own_members" ON members
  FOR SELECT
  USING (
    coach_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );

-- RLS policy : coach peut modifier ses propres membres
DROP POLICY IF EXISTS "coach_update_own_members" ON members;
CREATE POLICY "coach_update_own_members" ON members
  FOR UPDATE
  USING (
    coach_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    coach_id IN (
      SELECT id FROM staff WHERE user_id = auth.uid()
    )
  );
