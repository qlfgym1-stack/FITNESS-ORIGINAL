-- Migration 00020: Add permanent member_number to members
-- Format: QLF-XXXXX (configurable prefix, auto-incrementing)

-- Sequence for auto-incrementing member numbers (organization-scoped)
CREATE SEQUENCE IF NOT EXISTS seq_member_number START 1 INCREMENT 1;

-- Add member_number column (nullable initially for backfill)
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_number text;

-- Unique constraint (globally unique, not per-org)
ALTER TABLE members ADD CONSTRAINT members_member_number_key UNIQUE (member_number);

-- Index for fast search
CREATE INDEX IF NOT EXISTS idx_members_member_number ON members (member_number);

-- Function to generate the next member number
CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val bigint;
BEGIN
  seq_val := nextval('seq_member_number');
  RETURN 'QLF-' || LPAD(seq_val::text, 5, '0');
END;
$$;

-- Trigger function: auto-assign member_number on INSERT if not provided
CREATE OR REPLACE FUNCTION assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    NEW.member_number := generate_member_number();
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to members table (BEFORE INSERT so the value is set before row insertion)
DROP TRIGGER IF EXISTS trg_assign_member_number ON members;
CREATE TRIGGER trg_assign_member_number
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION assign_member_number();

-- Backfill existing members with sequential numbers (in creation order)
DO $$
DECLARE
  rec record;
  num_val text;
BEGIN
  FOR rec IN SELECT id FROM members WHERE member_number IS NULL ORDER BY created_at, id LOOP
    num_val := generate_member_number();
    UPDATE members SET member_number = num_val WHERE id = rec.id;
  END LOOP;
END;
$$;
