ALTER TABLE organizations
  ADD COLUMN coach_default_salary DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN coach_default_rate_per_member DECIMAL(10,2) DEFAULT 0;
