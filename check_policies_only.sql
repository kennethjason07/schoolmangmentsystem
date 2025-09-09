-- Check what RLS policies exist for exams table

SELECT 'RLS Policies for exams table:' as info;

SELECT 
    policyname as policy_name,
    cmd as operation_type,
    qual as condition_clause
FROM pg_policies 
WHERE tablename = 'exams' AND schemaname = 'public'
ORDER BY cmd;

-- Also check if RLS is enabled
SELECT 'Is RLS enabled on exams table?' as info;

SELECT 
    tablename,
    relrowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE t.tablename = 'exams' AND t.schemaname = 'public';
