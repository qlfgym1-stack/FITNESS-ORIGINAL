CREATE TABLE IF NOT EXISTS invoice_sequences (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  last_number INTEGER DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_invoice_number(p_organization_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INTEGER;
  v_year TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');

  INSERT INTO invoice_sequences (organization_id, last_number)
  VALUES (p_organization_id, 1)
  ON CONFLICT (organization_id)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN v_year || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;
