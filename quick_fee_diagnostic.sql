-- Quick diagnostic to understand the current state
-- Run this first to see what we're working with

-- 1. Check what tenants exist
SELECT 'TENANTS' as type, id, name, status FROM public.tenants LIMIT 5;

-- 2. Check sample users with student links
SELECT 'STUDENT USERS' as type, email, tenant_id, linked_student_id, role_id 
FROM public.users 
WHERE linked_student_id IS NOT NULL 
LIMIT 5;

-- 3. Check sample students
SELECT 'STUDENTS' as type, s.id, s.name, s.tenant_id, s.class_id, c.class_name
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id
LIMIT 5;

-- 4. Check if we have fee_structure data
SELECT 'FEE STRUCTURE COUNT' as type, 
       COUNT(*) as total_fees,
       COUNT(CASE WHEN student_id IS NULL THEN 1 END) as class_fees,
       COUNT(CASE WHEN student_id IS NOT NULL THEN 1 END) as student_specific_fees
FROM public.fee_structure;

-- 5. Check existing RLS policies on key tables
SELECT 'EXISTING POLICIES' as type, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('fee_structure', 'student_fees', 'users', 'students')
ORDER BY tablename;

-- 6. Check if RLS is enabled
SELECT 'RLS STATUS' as type, 
       t.table_name, 
       c.relrowsecurity as rls_enabled
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
  AND t.table_name IN ('fee_structure', 'student_fees', 'users', 'students');
