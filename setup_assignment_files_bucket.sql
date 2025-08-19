-- Assignment Files Bucket Setup for Student Submissions
-- Run this in your Supabase SQL Editor

-- 1. Create the assignment-files storage bucket (public for easy access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- 2. Drop existing policies to avoid conflicts  
DROP POLICY IF EXISTS "Allow authenticated uploads to assignment-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from assignment-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to assignment-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from assignment-files" ON storage.objects;

-- 3. Create comprehensive policies for assignment-files bucket

-- Policy 1: Allow authenticated users to upload files to assignment-files bucket
CREATE POLICY "Enable upload for authenticated users on assignment-files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'assignment-files' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow all users to read files from assignment-files bucket (public bucket)
CREATE POLICY "Enable read for all users on assignment-files" ON storage.objects
FOR SELECT USING (bucket_id = 'assignment-files');

-- Policy 3: Allow users to update their own files (filename contains user ID or student ID)
CREATE POLICY "Enable update for users based on user_id on assignment-files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'assignment-files' AND
  (auth.uid()::text = split_part(name, '_', 1) OR 
   auth.uid()::text = split_part(split_part(name, '/', 1), '_', 2))
) WITH CHECK (
  bucket_id = 'assignment-files' AND
  (auth.uid()::text = split_part(name, '_', 1) OR 
   auth.uid()::text = split_part(split_part(name, '/', 1), '_', 2))
);

-- Policy 4: Allow users to delete their own files (filename contains user ID or student ID)
CREATE POLICY "Enable delete for users based on user_id on assignment-files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'assignment-files' AND
  (auth.uid()::text = split_part(name, '_', 1) OR 
   auth.uid()::text = split_part(split_part(name, '/', 1), '_', 2))
);

-- 5. Verify the setup
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'assignment-files';

-- 6. Check the policies were created
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%assignment-files%';

-- Success message
SELECT 'assignment-files bucket created successfully' as status;
