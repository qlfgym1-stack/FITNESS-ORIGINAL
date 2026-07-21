ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_id UUID;

CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference_type, reference_id);

CREATE OR REPLACE FUNCTION sync_salary_payment_to_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_staff_name TEXT;
BEGIN
  SELECT COALESCE(first_name || ' ' || last_name, 'Employé') INTO v_staff_name FROM staff WHERE id = NEW.staff_id;

  INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, created_at, reference_type, reference_id)
  VALUES (
    NEW.organization_id,
    'salaries',
    'Salaire - ' || v_staff_name || ' (' || NEW.period || ')',
    NEW.amount,
    NEW.payment_date,
    NEW.created_by,
    NEW.created_at,
    'salary_payment',
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_salary_payment_to_expense ON staff_salary_payments;
CREATE TRIGGER trg_sync_salary_payment_to_expense
AFTER INSERT ON staff_salary_payments
FOR EACH ROW
EXECUTE FUNCTION sync_salary_payment_to_expense();

INSERT INTO expenses (organization_id, category, description, amount, expense_date, created_by, created_at, reference_type, reference_id)
SELECT
  sp.organization_id,
  'salaries',
  'Salaire - ' || COALESCE(s.first_name || ' ' || s.last_name, 'Employé') || ' (' || sp.period || ')',
  sp.amount,
  sp.payment_date,
  sp.created_by,
  sp.created_at,
  'salary_payment',
  sp.id
FROM staff_salary_payments sp
LEFT JOIN staff s ON s.id = sp.staff_id
WHERE NOT EXISTS (
  SELECT 1 FROM expenses e WHERE e.reference_type = 'salary_payment' AND e.reference_id = sp.id
);
