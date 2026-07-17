-- Add image_url column to inventory table
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create storage bucket for product/inventory images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- SELECT : any authenticated user in org can view
CREATE POLICY "Org members can view product images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles WHERE user_id = auth.uid()
  )
);

-- INSERT : admin/super_admin only
CREATE POLICY "Admin can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- UPDATE : admin/super_admin only
CREATE POLICY "Admin can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);

-- DELETE : admin/super_admin only
CREATE POLICY "Admin can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  )
);
