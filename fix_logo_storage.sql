-- Fix logo storage issues by setting up proper bucket policies
-- This script will help diagnose and fix logo loading issues

-- 1. Check existing buckets
SELECT 
    id as bucket_name,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
ORDER BY created_at;

-- 2. Check if profiles bucket exists and is public
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'profiles';

-- 3. Make profiles bucket public if it exists
UPDATE storage.buckets 
SET public = true 
WHERE id = 'profiles';

-- 4. Create profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 52428800, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- 5. Check RLS policies for storage.objects
SELECT 
    policyname,
    tablename,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- 6. Create RLS policies for profiles bucket if they don't exist

-- Allow public read access to profiles bucket
CREATE POLICY IF NOT EXISTS "Public read access for profiles bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Allow authenticated users to upload to profiles bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload to profiles"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profiles');

-- Allow users to update their own files in profiles bucket
CREATE POLICY IF NOT EXISTS "Users can update own files in profiles"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files in profiles bucket
CREATE POLICY IF NOT EXISTS "Users can delete own files in profiles"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Check what files exist in profiles bucket
SELECT 
    name,
    bucket_id,
    owner,
    created_at,
    updated_at,
    last_accessed_at,
    metadata
FROM storage.objects 
WHERE bucket_id = 'profiles'
AND (name ILIKE '%.jpg' OR name ILIKE '%.jpeg' OR name ILIKE '%.png' OR name ILIKE '%.gif')
ORDER BY created_at DESC
LIMIT 20;

-- 8. Check school_details table for logo_url
SELECT 
    id,
    name,
    logo_url,
    created_at,
    updated_at
FROM school_details 
ORDER BY created_at DESC
LIMIT 5;

-- 9. If you need to create a school-assets bucket instead
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-assets', 'school-assets', true, 52428800, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Create RLS policies for school-assets bucket
CREATE POLICY IF NOT EXISTS "Public read access for school-assets bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-assets');

CREATE POLICY IF NOT EXISTS "Authenticated users can upload to school-assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'school-assets');

CREATE POLICY IF NOT EXISTS "Authenticated users can update school-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'school-assets')
WITH CHECK (bucket_id = 'school-assets');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete from school-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'school-assets');

-- 10. Show final bucket status
SELECT 
    id as bucket_name,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id IN ('profiles', 'school-assets')
ORDER BY id;
