-- Check the actual structure of leave_applications table
-- Run this in Supabase SQL Editor to see the table schema

-- 1. Check if table exists
SELECT 'Checking if leave_applications table exists:' as info;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'leave_applications'
) as table_exists;

-- 2. Show all columns in the table
SELECT 'Table structure for leave_applications:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'leave_applications' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check for any data in the table
SELECT 'Current data count:' as info;
SELECT COUNT(*) as total_records FROM public.leave_applications;

-- 4. Show sample of existing data structure (if any)
SELECT 'Sample data (first 3 rows):' as info;
SELECT * FROM public.leave_applications LIMIT 3;

-- 5. Check RLS status
SELECT 'RLS status:' as info;
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'leave_applications' 
  AND schemaname = 'public';

-- 6. Check existing policies
SELECT 'Existing RLS policies:' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'leave_applications'
ORDER BY policyname;
