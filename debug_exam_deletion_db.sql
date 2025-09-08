-- COMPREHENSIVE DIAGNOSIS: Database Exam Deletion Issue
-- The logs show local state updates work but database deletion fails

-- ===============================
-- 1. CHECK CURRENT RLS POLICIES
-- ===============================
SELECT 'CHECKING CURRENT RLS POLICIES FOR EXAMS...' as status;

-- Show all current RLS policies for exams table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd as operation,
    qual as condition,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'exams'
ORDER BY cmd, policyname;

-- ===============================
-- 2. CHECK RLS STATUS ON EXAMS TABLE
-- ===============================
SELECT 'CHECKING RLS STATUS...' as status;

-- Check if RLS is enabled on exams table
SELECT 
    schemaname,
    tablename,
    relrowsecurity as rls_enabled,
    relforcerowsecurity as rls_forced
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND t.tablename = 'exams';

-- ===============================
-- 3. TEST DELETE PERMISSIONS
-- ===============================
SELECT 'TESTING DELETE PERMISSIONS...' as status;

-- Get current user info
SELECT 
    auth.uid() as current_user_id,
    (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as user_tenant_id;

-- Count exams that SHOULD be deletable by current user
SELECT COUNT(*) as deletable_exams_count
FROM public.exams 
WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- Show the specific exam that failed to delete
SELECT 
    id,
    name,
    tenant_id,
    class_id,
    'This is the exam that should have been deleted' as note
FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa';

-- ===============================
-- 4. CHECK FOR FOREIGN KEY CONSTRAINTS
-- ===============================
SELECT 'CHECKING FOREIGN KEY CONSTRAINTS...' as status;

-- Check what tables reference the exams table
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'exams'
AND tc.table_schema = 'public';

-- ===============================
-- 5. CHECK FOR RELATED MARKS DATA
-- ===============================
SELECT 'CHECKING RELATED MARKS DATA...' as status;

-- Check if there are marks referencing this exam
SELECT COUNT(*) as related_marks_count
FROM public.marks 
WHERE exam_id = '10955ce9-acad-4506-823f-7919472cedaa';

-- Show the related marks (if any)
SELECT 
    id,
    exam_id,
    student_id,
    subject_id,
    marks_obtained,
    tenant_id
FROM public.marks 
WHERE exam_id = '10955ce9-acad-4506-823f-7919472cedaa'
LIMIT 5;

-- ===============================
-- 6. MANUAL DELETE TEST
-- ===============================
SELECT 'ATTEMPTING MANUAL DELETE TEST...' as status;

-- Try to manually delete the exam (this will show us the exact error)
-- First, let's try deleting related marks
DELETE FROM public.marks 
WHERE exam_id = '10955ce9-acad-4506-823f-7919472cedaa'
AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- Show how many marks were deleted
SELECT 'MARKS DELETION RESULT:' as status, 
       (SELECT COUNT(*) FROM public.marks WHERE exam_id = '10955ce9-acad-4506-823f-7919472cedaa') as remaining_marks;

-- Now try to delete the exam itself
DELETE FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa'
AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- Check if exam was actually deleted
SELECT 'EXAM DELETION RESULT:' as status,
       (SELECT COUNT(*) FROM public.exams WHERE id = '10955ce9-acad-4506-823f-7919472cedaa') as exam_still_exists;

-- ===============================
-- 7. FINAL STATUS
-- ===============================
SELECT 'FINAL DIAGNOSIS COMPLETE' as status;
SELECT 'Check the results above to identify why database deletion is failing' as next_step;
