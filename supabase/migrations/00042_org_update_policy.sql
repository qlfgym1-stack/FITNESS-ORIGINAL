CREATE POLICY "Admins can update their organization" ON organizations
  FOR UPDATE USING (
    id IN (SELECT organization_id FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
