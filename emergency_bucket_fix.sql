-- EMERGENCY FIX: Remove all RLS restrictions on homework-files bucket
-- Run this in your Supabase SQL Editor

-- Step 1: Create the bucket if it doesn't exist (with public access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-files', 'homework-files', true)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  name = 'homework-files';

-- Step 2: Drop ALL existing policies on storage.objects that might interfere
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Loop through all policies on storage.objects and drop them
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects'
          AND (
            policyname LIKE '%homework%' 
            OR policyname LIKE '%authenticated%'
            OR policyname LIKE '%upload%'
            OR policyname LIKE '%files%'
          )
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON storage.objects';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Step 3: Create the most permissive policy possible for homework-files
CREATE POLICY "homework_files_full_access" ON storage.objects
FOR ALL 
TO public 
USING (bucket_id = 'homework-files')
WITH CHECK (bucket_id = 'homework-files');

-- Step 4: Alternative - disable RLS entirely on storage.objects (ONLY FOR TESTING)
-- WARNING: This makes ALL storage buckets publicly accessible
-- ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Step 5: Verify the setup
SELECT 'Bucket Status:' as info_type, id, name, public::text as value
FROM storage.buckets 
WHERE id = 'homework-files'
UNION ALL
SELECT 'Policy Status:' as info_type, policyname as id, roles::text as name, cmd::text as value
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage' 
  AND policyname = 'homework_files_full_access';

-- Step 6: Test query to simulate what the upload function does
SELECT 
  'Test Access Check' as test,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM storage.buckets 
      WHERE id = 'homework-files' AND public = true
    ) THEN 'PASS: Bucket is public'
    ELSE 'FAIL: Bucket is not public or does not exist'
  END as result;
