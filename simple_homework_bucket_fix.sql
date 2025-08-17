-- Simple fix: Allow all authenticated users to upload/read homework files
-- Run this in your Supabase SQL editor

-- 1. Make bucket public for easier access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework-files';

-- 2. Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Allow authenticated uploads to homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to homework-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from homework-files" ON storage.objects;

-- 3. Create a simple policy to allow all authenticated users
CREATE POLICY "Allow authenticated homework files access" ON storage.objects
FOR ALL 
TO authenticated 
USING (bucket_id = 'homework-files')
WITH CHECK (bucket_id = 'homework-files');

-- 4. Verify the setup
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'homework-files';

-- 5. Check the policy was created
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname = 'Allow authenticated homework files access';
