-- Check Actual Table Structures and Data
-- This will show the real column names before querying data

-- ===============================================
-- 1. CHECK CURRENT USER
-- ===============================================
SELECT 
  '=== CURRENT AUTH USER ===' as info,
  auth.uid() as auth_id,
  CASE WHEN auth.uid() IS NULL THEN 'NOT LOGGED IN' ELSE 'LOGGED IN' END as status;

-- ===============================================
-- 2. SHOW USERS TABLE STRUCTURE
-- ===============================================
SELECT '=== USERS TABLE STRUCTURE ===' as info;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===============================================
-- 3. SHOW STUDENTS TABLE STRUCTURE  
-- ===============================================
SELECT '=== STUDENTS TABLE STRUCTURE ===' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'students' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===============================================
-- 4. SHOW FEE_STRUCTURE TABLE STRUCTURE
-- ===============================================
SELECT '=== FEE_STRUCTURE TABLE STRUCTURE ===' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'fee_structure' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===============================================
-- 5. SHOW STUDENT_FEES TABLE STRUCTURE
-- ===============================================
SELECT '=== STUDENT_FEES TABLE STRUCTURE ===' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'student_fees' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===============================================
-- 6. SHOW TENANTS TABLE STRUCTURE
-- ===============================================
SELECT '=== TENANTS TABLE STRUCTURE ===' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'tenants' AND table_schema = 'public'
ORDER BY ordinal_position;

-- ===============================================
-- 7. NOW SHOW ACTUAL DATA (using * to avoid column errors)
-- ===============================================

SELECT '=== USERS TABLE DATA ===' as info;
SELECT * FROM public.users LIMIT 3;

SELECT '=== TENANTS TABLE DATA ===' as info;
SELECT * FROM public.tenants LIMIT 3;

SELECT '=== STUDENTS TABLE DATA ===' as info;
SELECT * FROM public.students LIMIT 3;

SELECT '=== FEE_STRUCTURE TABLE DATA ===' as info;
SELECT * FROM public.fee_structure LIMIT 3;

SELECT '=== STUDENT_FEES TABLE DATA ===' as info;
SELECT * FROM public.student_fees LIMIT 3;

-- ===============================================
-- 8. COUNT RECORDS IN KEY TABLES
-- ===============================================
SELECT 
  '=== RECORD COUNTS ===' as info,
  (SELECT COUNT(*) FROM public.users) as users_count,
  (SELECT COUNT(*) FROM public.tenants) as tenants_count,
  (SELECT COUNT(*) FROM public.students) as students_count,
  (SELECT COUNT(*) FROM public.fee_structure) as fee_structure_count,
  (SELECT COUNT(*) FROM public.student_fees) as student_fees_count;
