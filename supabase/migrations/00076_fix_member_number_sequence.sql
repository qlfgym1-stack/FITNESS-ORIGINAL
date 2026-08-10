-- Migration 00076: Fix duplicate key violation on members_org_member_number_unique
-- Cause racine : seq_member_number (globale) désynchronisée du max existant
-- (données insérées avec des numéros explicites par-org), le trigger régénérait
-- des numéros déjà utilisés dans la même organisation.

-- 1. Remettre la séquence à niveau : prochain nextval > max existant
SELECT setval('seq_member_number',
  (SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(member_number, '\D', '', 'g'), '')::bigint), 0)
   FROM members)
);

-- 2. generate_member_number anti-collision per-org
CREATE OR REPLACE FUNCTION generate_member_number(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  seq_val bigint;
  candidate text;
  attempts int := 0;
BEGIN
  LOOP
    attempts := attempts + 1;
    seq_val := nextval('seq_member_number');
    candidate := 'QLF-' || LPAD(seq_val::text, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM members
      WHERE organization_id = p_org_id
        AND member_number = candidate
    );
    IF attempts >= 1000 THEN
      RAISE EXCEPTION 'Unable to allocate a unique member number';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Trigger : passer l'organisation pour l'anti-collision
CREATE OR REPLACE FUNCTION assign_member_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.member_number IS NULL THEN
    NEW.member_number := generate_member_number(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_member_number ON members;
CREATE TRIGGER trg_assign_member_number
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION assign_member_number();

-- 4. Réconcilier le schéma : contrainte per-org côté remote (idempotent)
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_member_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS members_org_member_number_unique
  ON members (organization_id, member_number);
