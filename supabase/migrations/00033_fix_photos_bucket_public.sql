-- Fix photos bucket: set public to allow getPublicUrl() to serve files
-- Previously public was false, causing all avatar images to return 400

UPDATE storage.buckets SET public = true WHERE id = 'photos';
