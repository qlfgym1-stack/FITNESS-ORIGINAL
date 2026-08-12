-- ============================================================================
-- 00090 — Import ancien logiciel : schéma, snapshots, colonnes, traçabilité
--
-- Contexte : la BDD QLF GYM contient 873 membres réels (851 seedés depuis le
-- même backup + 22 créés dans l'app) et 300 membres de démonstration dans une
-- organisation séparée "FitManager Démo". Ce lot prépare l'import contrôlé
-- des 1358 lignes d'abonnement du fichier "abonnement excel.xlsx".
--
-- Contenu :
--   1. Snapshot de sécurité (schéma _bak) avant toute modification
--   2. Colonnes de préservation / traçabilité (nullable, non cassantes)
--   3. Tables publiques import_batches + import_mapping (RLS admin write)
--   4. Type d'abonnement "Par séance" (idempotent)
--   5. Remise à niveau de la séquence member_number
-- ============================================================================

-- 1. Snapshots de sécurité --------------------------------------------------
CREATE SCHEMA IF NOT EXISTS _bak;

DROP TABLE IF EXISTS _bak.members_snapshot;
CREATE TABLE _bak.members_snapshot AS SELECT * FROM members;
DROP TABLE IF EXISTS _bak.subs_snapshot;
CREATE TABLE _bak.subs_snapshot AS SELECT * FROM member_subscriptions;
DROP TABLE IF EXISTS _bak.payments_snapshot;
CREATE TABLE _bak.payments_snapshot AS SELECT * FROM payments;

-- 2. Colonnes de préservation / traçabilité (nullable) ----------------------
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS barcode TEXT,
  ADD COLUMN IF NOT EXISTS legacy_id TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT;

ALTER TABLE member_subscriptions
  ADD COLUMN IF NOT EXISTS legacy_id TEXT,
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS sessions_total INT,
  ADD COLUMN IF NOT EXISTS sessions_used INT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS import_source TEXT;

COMMENT ON COLUMN members.legacy_id IS 'Identifiant membre dans l''ancien logiciel (backup excel)';
COMMENT ON COLUMN members.import_source IS 'Provenance du membre (ex: BACKUP_ANCIEN_LOGICIEL)';
COMMENT ON COLUMN member_subscriptions.sessions_total IS 'Nombre de séances du pack (type "Par séance")';
COMMENT ON COLUMN member_subscriptions.sessions_used IS 'Séances déjà consommées (ancien logiciel)';

-- 3. Tables publiques de traçabilité (RLS) ----------------------------------
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  source_type TEXT DEFAULT 'BACKUP_ANCIEN_LOGICIEL',
  total_lines INT DEFAULT 0,
  imported_members INT DEFAULT 0,
  created_members INT DEFAULT 0,
  matched_members INT DEFAULT 0,
  imported_subs INT DEFAULT 0,
  imported_payments INT DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES import_batches(id) ON DELETE CASCADE,
  line_no INT NOT NULL,
  legacy_member_id TEXT,
  legacy_sub_id TEXT,
  db_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  db_sub_id UUID REFERENCES member_subscriptions(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'matched', 'skipped', 'ambig')),
  match_level TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_mapping_batch ON import_mapping (batch_id);
CREATE INDEX IF NOT EXISTS idx_import_mapping_member ON import_mapping (db_member_id);

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_mapping ENABLE ROW LEVEL SECURITY;

-- Lecture : tout utilisateur authentifié de l'org du lot
CREATE POLICY import_batches_select ON import_batches
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );
CREATE POLICY import_mapping_select ON import_mapping
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Écriture : réservée admin (rôle admin dans l'org du lot)
CREATE POLICY import_batches_admin_insert ON import_batches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = import_batches.organization_id
        AND ur.role = 'admin'
    )
  );
CREATE POLICY import_batches_admin_update ON import_batches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = import_batches.organization_id
        AND ur.role = 'admin'
    )
  );
CREATE POLICY import_batches_admin_delete ON import_batches
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.organization_id = import_batches.organization_id
        AND ur.role = 'admin'
    )
  );
CREATE POLICY import_mapping_admin_insert ON import_mapping
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_batches ib
      JOIN user_roles ur ON ur.organization_id = ib.organization_id
      WHERE ib.id = import_mapping.batch_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- 4. Type d'abonnement "Par séance" (idempotent) -----------------------------
INSERT INTO subscription_types (organization_id, name, description, duration_days, price, max_classes)
SELECT o.id, 'Par séance', 'Pack de séances (ancien logiciel)', 30, 2000, 12
FROM organizations o
WHERE o.name = 'QLF GYM'
  AND NOT EXISTS (
    SELECT 1 FROM subscription_types st
    WHERE st.organization_id = o.id AND st.name = 'Par séance'
  );

-- 5. Séquence member_number remise à niveau ----------------------------------
SELECT setval('seq_member_number',
  (SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(member_number, '\D', '', 'g'), '')::bigint), 0)
   FROM members)
);
