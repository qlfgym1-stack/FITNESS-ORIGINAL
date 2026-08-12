-- ============================================================================
-- 00089 — members.full_name (NOM & PRÉNOM en un seul champ)
--
-- Objectif : l'interface ne doit plus demander NOM + PRÉNOM séparément mais un
-- seul champ "NOM & PRÉNOM", tout en CONSERVANT la compatibilité des colonnes
-- existantes first_name / last_name (utilisées par le staff, les RPC, l'import,
-- la recherche…).
--
-- Note : la version initiale utilisait une colonne GENERATED ALWAYS AS STORED,
-- mais Postgres rejetait l'expression (42P17 — non immutable, même avec
-- btrim()/concat_ws()). On utilise donc un trigger BEFORE INSERT/UPDATE, qui
-- maintient full_name automatiquement sans contrainte d'immutabilité.
--   - Écriture : le front continue de fournir first_name/last_name (le champ
--     unique est découpé avant envoi), le trigger remplit full_name.
--   - Lectures / recherche : full_name est toujours synchronisé.
-- ============================================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Maintient full_name = "prénom nom" (espaces rognés) à chaque écriture.
CREATE OR REPLACE FUNCTION public.sync_member_full_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.full_name := btrim(concat_ws(' ', NEW.first_name, NEW.last_name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_members_sync_full_name
BEFORE INSERT OR UPDATE OF first_name, last_name ON members
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_full_name();

-- Backfill des lignes existantes (le trigger ne s'active pas : first_name/
-- last_name ne sont pas dans le SET).
UPDATE members
SET full_name = btrim(concat_ws(' ', first_name, last_name));

-- Index pour accélérer la recherche par nom complet
CREATE INDEX IF NOT EXISTS idx_members_full_name ON members (full_name);
