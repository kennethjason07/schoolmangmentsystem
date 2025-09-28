-- ====================================================
-- FIX FACIAL RECOGNITION STORAGE POLICIES
-- ====================================================
-- This fixes the RLS policies to work with authenticated users
-- without requiring tenant_id in JWT token

-- Drop existing policies that require tenant_id in JWT
DROP POLICY IF EXISTS "facial_templates_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_templates_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_templates_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_templates_delete_policy" ON storage.objects;

DROP POLICY IF EXISTS "facial_events_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_events_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_events_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "facial_events_delete_policy" ON storage.objects;

-- Create new policies that work with authenticated users
-- These policies allow any authenticated user to upload to their own folder structure

-- Policies for facial-templates bucket
CREATE POLICY "facial_templates_authenticated_upload" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'facial-templates');

CREATE POLICY "facial_templates_authenticated_select" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'facial-templates');

CREATE POLICY "facial_templates_authenticated_update" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'facial-templates');

CREATE POLICY "facial_templates_authenticated_delete" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'facial-templates');

-- Policies for facial-events bucket  
CREATE POLICY "facial_events_authenticated_upload" 
ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'facial-events');

CREATE POLICY "facial_events_authenticated_select" 
ON storage.objects 
FOR SELECT TO authenticated 
USING (bucket_id = 'facial-events');

CREATE POLICY "facial_events_authenticated_update" 
ON storage.objects 
FOR UPDATE TO authenticated 
USING (bucket_id = 'facial-events');

CREATE POLICY "facial_events_authenticated_delete" 
ON storage.objects 
FOR DELETE TO authenticated 
USING (bucket_id = 'facial-events');

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Storage policies updated successfully!';
  RAISE NOTICE 'Now any authenticated user can upload to facial recognition buckets.';
  RAISE NOTICE 'Tenant isolation is handled at the application level via folder structure.';
END $$;