-- =============================================================================
-- Migration 00023 : Fix photos bucket RLS + invoice_sequences RLS
-- =============================================================================

-- 1. Photos bucket : remplacer les policies trop permissives par des policies
--    basées sur le chemin (organization_id/member_id/filename)

DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- SELECT : tout staff/coach/admin de l'organisation
CREATE POLICY "Staff can view org photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- INSERT : admin/super_admin uniquement
CREATE POLICY "Admin can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- UPDATE : admin/super_admin uniquement
CREATE POLICY "Admin can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- DELETE : admin/super_admin uniquement
CREATE POLICY "Admin can delete photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- =============================================================================
-- 2. Activer RLS sur invoice_sequences (table créée en 00018 sans RLS)
-- =============================================================================

ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

-- SELECT : staff de l'organisation
CREATE POLICY "Staff can view invoice sequences"
ON invoice_sequences FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM user_roles WHERE user_id = auth.uid()
  )
);

-- ALL (INSERT/UPDATE/DELETE) : admin/super_admin uniquement
CREATE POLICY "Admin can manage invoice sequences"
ON invoice_sequences FOR ALL
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
