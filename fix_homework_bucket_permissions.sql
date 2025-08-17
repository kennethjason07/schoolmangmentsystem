-- Fix homework-files bucket permissions
-- Run this in your Supabase SQL editor

-- 1. Disable RLS on the homework-files bucket (for testing)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'homework-files';

-- 2. Create a policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads to homework-files" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'homework-files');

-- 3. Create a policy to allow authenticated users to read files  
CREATE POLICY "Allow authenticated reads from homework-files" ON storage.objects
FOR SELECT 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 4. Create a policy to allow authenticated users to update files
CREATE POLICY "Allow authenticated updates to homework-files" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 5. Create a policy to allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes from homework-files" ON storage.objects
FOR DELETE 
TO authenticated 
USING (bucket_id = 'homework-files');

-- 6. Alternative: If you want to make it completely public (not recommended for production)
-- CREATE POLICY "Allow public uploads to homework-files" ON storage.objects
-- FOR INSERT 
-- TO public 
-- WITH CHECK (bucket_id = 'homework-files');

-- CREATE POLICY "Allow public reads from homework-files" ON storage.objects
-- FOR SELECT 
-- TO public 
-- USING (bucket_id = 'homework-files');

-- Verify the bucket configuration
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'homework-files';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage';
