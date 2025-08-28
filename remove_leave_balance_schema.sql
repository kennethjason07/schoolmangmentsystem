-- Script to remove leave balance concept from the database
-- Run this in your Supabase SQL Editor

-- 1. Drop the trigger first
DROP TRIGGER IF EXISTS trigger_update_leave_balance ON public.leave_applications;

-- 2. Drop the function
DROP FUNCTION IF EXISTS update_leave_balance();

-- 3. Drop the teacher_leave_balance table
DROP TABLE IF EXISTS public.teacher_leave_balance CASCADE;

-- 4. Remove any indexes that were created for leave balance
DROP INDEX IF EXISTS idx_teacher_leave_balance_teacher_year;

-- Verification queries to confirm removal
-- These should return no results after running the above

-- Check if table exists (should return empty)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'teacher_leave_balance';

-- Check if trigger exists (should return empty)
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_leave_balance';

-- Check if function exists (should return empty)
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_leave_balance';

-- The leave_applications table remains unchanged
-- Teachers can still apply for leave without balance restrictions
SELECT 'Leave applications table still exists' as status, count(*) as total_applications
FROM public.leave_applications;
