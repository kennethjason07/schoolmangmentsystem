-- ====================================================
-- FACIAL RECOGNITION STORAGE SETUP
-- ====================================================
-- Run this script in your Supabase SQL Editor to create storage buckets
-- and set up proper RLS policies for facial recognition images

-- Create facial-templates bucket for enrollment photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'facial-templates',
  'facial-templates',
  false, -- Private bucket
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create facial-events bucket for recognition attempt photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'facial-events',
  'facial-events',
  false, -- Private bucket
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS Policies for facial-templates bucket
-- Policy for uploading files to tenant folder
DROP POLICY IF EXISTS "facial_templates_upload_policy" ON storage.objects;
CREATE POLICY "facial_templates_upload_policy" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for viewing files from tenant folder
DROP POLICY IF EXISTS "facial_templates_select_policy" ON storage.objects;
CREATE POLICY "facial_templates_select_policy" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for updating files in tenant folder
DROP POLICY IF EXISTS "facial_templates_update_policy" ON storage.objects;
CREATE POLICY "facial_templates_update_policy" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for deleting files from tenant folder
DROP POLICY IF EXISTS "facial_templates_delete_policy" ON storage.objects;
CREATE POLICY "facial_templates_delete_policy" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'facial-templates' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- RLS Policies for facial-events bucket
-- Policy for uploading files to tenant folder
DROP POLICY IF EXISTS "facial_events_upload_policy" ON storage.objects;
CREATE POLICY "facial_events_upload_policy" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for viewing files from tenant folder
DROP POLICY IF EXISTS "facial_events_select_policy" ON storage.objects;
CREATE POLICY "facial_events_select_policy" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for updating files in tenant folder
DROP POLICY IF EXISTS "facial_events_update_policy" ON storage.objects;
CREATE POLICY "facial_events_update_policy" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Policy for deleting files from tenant folder (cleanup)
DROP POLICY IF EXISTS "facial_events_delete_policy" ON storage.objects;
CREATE POLICY "facial_events_delete_policy" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'facial-events' AND
  (storage.foldername(name))[1] = (auth.jwt() ->> 'tenant_id')::text
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Facial Recognition Storage Setup completed successfully!';
  RAISE NOTICE 'Created buckets:';
  RAISE NOTICE '1. facial-templates - for enrollment photos (private, 2MB limit)';
  RAISE NOTICE '2. facial-events - for recognition attempts (private, 2MB limit)';
  RAISE NOTICE 'All RLS policies configured with tenant isolation.';
  RAISE NOTICE 'Next: Configure environment variables and download face models.';
END $$;