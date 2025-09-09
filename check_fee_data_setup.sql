-- Check Fee Data Setup for Student Access
-- Based on your actual database tables: fee_structure, student_fees, student_discounts

-- ===============================================
-- 1. CHECK CURRENT USER STATUS
-- ===============================================
SELECT 
  '=== CURRENT USER STATUS ===' as section,
  auth.uid() as current_auth_id,
  CASE WHEN auth.uid() IS NULL THEN 'NOT AUTHENTICATED' ELSE 'AUTHENTICATED' END as auth_status;

-- ===============================================
-- 2. CHECK USER RECORD IN USERS TABLE
-- ===============================================
SELECT '=== USERS TABLE CHECK ===' as section;

-- Show current user's record if exists
SELECT 
  id,
  email,
  full_name,
  tenant_id,
  role_id,
  linked_student_id,
  created_at
FROM public.users 
WHERE id = auth.uid()
LIMIT 1;

-- If no user found, show all users for reference
SELECT '=== ALL USERS (for reference) ===' as section;
SELECT 
  id,
  email,
  full_name,  
  tenant_id,
  role_id,
  linked_student_id
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- ===============================================
-- 3. CHECK TENANTS TABLE
-- ===============================================
SELECT '=== TENANTS TABLE ===' as section;
SELECT 
  id,
  name,
  subdomain,
  status,
  created_at
FROM public.tenants 
ORDER BY created_at DESC;

-- ===============================================
-- 4. CHECK STUDENTS TABLE
-- ===============================================
SELECT '=== STUDENTS TABLE ===' as section;
SELECT 
  id,
  name,
  class_id,
  tenant_id,
  roll_no,
  admission_no,
  created_at
FROM public.students 
ORDER BY created_at DESC 
LIMIT 5;

-- ===============================================
-- 5. CHECK FEE_STRUCTURE TABLE
-- ===============================================
SELECT '=== FEE_STRUCTURE TABLE ===' as section;
SELECT 
  id,
  fee_name,
  amount,
  tenant_id,
  class_id,
  academic_year,
  created_at
FROM public.fee_structure 
ORDER BY created_at DESC 
LIMIT 5;

-- ===============================================
-- 6. CHECK STUDENT_FEES TABLE
-- ===============================================
SELECT '=== STUDENT_FEES TABLE ===' as section;
SELECT 
  id,
  student_id,
  fee_structure_id,
  amount_due,
  amount_paid,
  status,
  tenant_id,
  created_at
FROM public.student_fees 
ORDER BY created_at DESC 
LIMIT 5;

-- ===============================================
-- 7. CHECK STUDENT_DISCOUNTS TABLE
-- ===============================================
SELECT '=== STUDENT_DISCOUNTS TABLE ===' as section;
SELECT 
  id,
  student_id,
  discount_amount,
  discount_percentage,
  tenant_id,
  created_at
FROM public.student_discounts 
ORDER BY created_at DESC 
LIMIT 5;

-- ===============================================
-- 8. CHECK CLASSES TABLE
-- ===============================================
SELECT '=== CLASSES TABLE ===' as section;
SELECT 
  id,
  class_name,
  section,
  tenant_id,
  academic_year,
  created_at
FROM public.classes 
ORDER BY created_at DESC 
LIMIT 3;

-- ===============================================
-- 9. SHOW TABLE COUNTS
-- ===============================================
SELECT '=== TABLE COUNTS ===' as section,
  'tenants' as table_name,
  COUNT(*) as record_count
FROM public.tenants
UNION ALL
SELECT '=== TABLE COUNTS ===' as section,
  'users' as table_name,
  COUNT(*) as record_count  
FROM public.users
UNION ALL
SELECT '=== TABLE COUNTS ===' as section,
  'students' as table_name,
  COUNT(*) as record_count
FROM public.students
UNION ALL
SELECT '=== TABLE COUNTS ===' as section,
  'fee_structure' as table_name,
  COUNT(*) as record_count
FROM public.fee_structure
UNION ALL
SELECT '=== TABLE COUNTS ===' as section,
  'student_fees' as table_name,
  COUNT(*) as record_count
FROM public.student_fees;

-- ===============================================
-- 10. CHECK USER-STUDENT-TENANT LINKAGE
-- ===============================================
SELECT '=== USER-STUDENT-TENANT LINKAGE ===' as section;
SELECT 
  u.email as user_email,
  u.tenant_id as user_tenant_id,
  t.name as tenant_name,
  u.linked_student_id,
  s.name as student_name,
  s.tenant_id as student_tenant_id,
  CASE 
    WHEN u.tenant_id = s.tenant_id THEN 'TENANT MATCH ✅'
    ELSE 'TENANT MISMATCH ❌'
  END as tenant_check
FROM public.users u
LEFT JOIN public.tenants t ON u.tenant_id = t.id  
LEFT JOIN public.students s ON u.linked_student_id = s.id
WHERE u.id = auth.uid();
