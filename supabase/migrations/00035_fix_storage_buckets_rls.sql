-- Migration 00035: Fix storage buckets public flag + apply proper RLS policies
-- This migration was created after discovering that:
--   1. product-images bucket does NOT exist on remote (migration 00029 never applied)
--   2. photos bucket RLS policies are still the permissive originals from 00016
--      (migration 00023 with org-based RLS was never applied on remote)

-- =============================================================================
-- 1. Ensure photos bucket is public (idempotent)
-- =============================================================================
UPDATE storage.buckets SET public = true WHERE id = 'photos';

-- =============================================================================
-- 2. Create product-images bucket if not exists (from 00029)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. Drop old permissive policies on photos bucket (from 00016)
-- =============================================================================
DROP POLICY IF EXISTS "Authenticated users can read photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own photos" ON storage.objects;

-- =============================================================================
-- 4. Apply org-based RLS policies for photos bucket (from 00023)
-- =============================================================================

DROP POLICY IF EXISTS "Staff can view org photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete photos" ON storage.objects;

CREATE POLICY "Staff can view org photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admin can upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can delete photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- =============================================================================
-- 5. Apply RLS policies for product-images bucket (from 00029)
-- =============================================================================

DROP POLICY IF EXISTS "Org members can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete product images" ON storage.objects;

CREATE POLICY "Org members can view product images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admin can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

CREATE POLICY "Admin can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
