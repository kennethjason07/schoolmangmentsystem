-- Setup permissions for student uploads to homework-files bucket
-- Run this in your Supabase SQL Editor

-- 1. Ensure the bucket is public (if it's not already)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework-files';

-- 2. Create or update policy to allow all authenticated users to upload files
-- (This will work for both teachers and students)
CREATE POLICY IF NOT EXISTS "Allow authenticated uploads to homework-files" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'homework-files');

-- 3. Create or update policy to allow all authenticated users to read files
CREATE POLICY IF NOT EXISTS "Allow authenticated reads from homework-files" ON storage.objects
FOR SELECT 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 4. Create or update policy to allow all authenticated users to update files
CREATE POLICY IF NOT EXISTS "Allow authenticated updates to homework-files" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 5. Create or update policy to allow all authenticated users to delete files
CREATE POLICY IF NOT EXISTS "Allow authenticated deletes from homework-files" ON storage.objects
FOR DELETE 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 6. Verify the setup
SELECT 
  'Bucket Status' as info_type,
  id as bucket_id,
  name as bucket_name,
  public::text as is_public,
  created_at
FROM storage.buckets 
WHERE id = 'homework-files'

UNION ALL

SELECT 
  'Policy Status' as info_type,
  policyname as bucket_id,
  roles::text as bucket_name,
  cmd::text as is_public,
  NULL as created_at
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%homework%'
ORDER BY info_type, bucket_id;
