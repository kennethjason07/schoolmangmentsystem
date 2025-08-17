-- Check current status of homework-files bucket and policies
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if the bucket exists and its current settings
SELECT 
  id, 
  name, 
  public, 
  avif_autodetection,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'homework-files' OR name = 'homework-files';

-- 2. Check all storage policies that might affect homework-files
SELECT 
  schemaname,
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND (
    policyname LIKE '%homework%' 
    OR qual LIKE '%homework-files%'
    OR with_check LIKE '%homework-files%'
  );

-- 3. Check all policies on storage.objects (to see what's blocking us)
SELECT 
  policyname, 
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check  
    ELSE 'No WITH CHECK clause'
  END as with_check_clause
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
ORDER BY policyname;

-- 4. Check if RLS is enabled on storage.objects table
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';

-- 5. Check current user's role (should be authenticated)
SELECT 
  current_user as current_database_user,
  session_user,
  current_setting('role') as current_role;
