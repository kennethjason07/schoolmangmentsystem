-- Debug Student Dashboard Issues
-- Run this in Supabase SQL Editor to diagnose any remaining problems
-- Replace 'YOUR_STUDENT_EMAIL' with the actual student email you're testing with

-- ==========================================
-- STEP 1: Check user and tenant setup
-- ==========================================

-- Check if the student user exists and has proper tenant_id
SELECT 'Checking student user setup...' as info;

SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  u.role_id,
  u.linked_student_id,
  u.tenant_id as user_tenant_id,
  r.role_name
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.email = 'YOUR_STUDENT_EMAIL'; -- Replace with actual email

-- ==========================================
-- STEP 2: Check student record
-- ==========================================

-- Check if the linked student record exists
SELECT 'Checking student record...' as info;

SELECT 
  s.id as student_id,
  s.name,
  s.admission_no,
  s.roll_no,
  s.class_id,
  s.tenant_id as student_tenant_id,
  c.class_name,
  c.section
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id
WHERE s.id = (
  SELECT linked_student_id 
  FROM public.users 
  WHERE email = 'YOUR_STUDENT_EMAIL'
);

-- ==========================================
-- STEP 3: Check tenant consistency
-- ==========================================

-- Verify tenant_id consistency between user and student
SELECT 'Checking tenant consistency...' as info;

SELECT 
  u.email,
  u.tenant_id as user_tenant_id,
  s.tenant_id as student_tenant_id,
  CASE 
    WHEN u.tenant_id = s.tenant_id THEN '✅ Consistent'
    ELSE '❌ Mismatch - This will cause dashboard issues!'
  END as tenant_consistency
FROM public.users u
LEFT JOIN public.students s ON u.linked_student_id = s.id
WHERE u.email = 'YOUR_STUDENT_EMAIL';

-- ==========================================
-- STEP 4: Test RLS policies are working
-- ==========================================

-- Test if the get_user_tenant_id() function works
SELECT 'Testing get_user_tenant_id() function...' as info;

-- This should return a tenant_id (will be null if not authenticated)
SELECT public.get_user_tenant_id() as current_tenant_id;

-- ==========================================
-- STEP 5: Check data availability for student
-- ==========================================

-- Test core tables that dashboard needs
SELECT 'Testing data access for dashboard tables...' as info;

-- Count records in each table for the student's tenant
WITH student_info AS (
  SELECT s.tenant_id, s.id as student_id, s.class_id
  FROM public.students s
  JOIN public.users u ON s.id = u.linked_student_id
  WHERE u.email = 'YOUR_STUDENT_EMAIL'
)
SELECT 
  'assignments' as table_name,
  COUNT(*) as record_count
FROM public.assignments a, student_info si
WHERE a.tenant_id = si.tenant_id AND a.class_id = si.class_id

UNION ALL

SELECT 
  'homeworks' as table_name,
  COUNT(*) as record_count
FROM public.homeworks h, student_info si
WHERE h.tenant_id = si.tenant_id

UNION ALL

SELECT 
  'marks' as table_name,
  COUNT(*) as record_count
FROM public.marks m, student_info si
WHERE m.tenant_id = si.tenant_id AND m.student_id = si.student_id

UNION ALL

SELECT 
  'student_attendance' as table_name,
  COUNT(*) as record_count
FROM public.student_attendance sa, student_info si
WHERE sa.tenant_id = si.tenant_id AND sa.student_id = si.student_id

UNION ALL

SELECT 
  'events' as table_name,
  COUNT(*) as record_count
FROM public.events e, student_info si
WHERE e.tenant_id = si.tenant_id

UNION ALL

SELECT 
  'notifications' as table_name,
  COUNT(*) as record_count
FROM public.notifications n, student_info si
WHERE n.tenant_id = si.tenant_id

ORDER BY table_name;

-- ==========================================
-- STEP 6: Check current RLS policies
-- ==========================================

SELECT 'Current RLS policies for key tables:' as info;

SELECT 
  tablename,
  policyname,
  roles,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename IN ('users', 'students', 'assignments', 'marks', 'notifications')
ORDER BY tablename, policyname;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

SELECT '🔍 Diagnostic complete!' as status;
SELECT 'If you see any ❌ Mismatch errors above, those need to be fixed.' as instruction1;
SELECT 'If record counts are 0 but should have data, check your sample data.' as instruction2;
SELECT 'If policies are missing, re-run the RLS policies script.' as instruction3;
