-- ============================================================
-- COMPREHENSIVE DIAGNOSTIC FOR STUDENT FEE PAYMENT ISSUE
-- ============================================================
-- This script diagnoses why student fee payments show 0 for all amounts
-- Based on the email-based tenant system described in EMAIL_BASED_TENANT_SYSTEM.md

BEGIN;

-- Get information about the currently logged in user (if any)
SELECT 
  'CURRENT SESSION INFO' as section,
  auth.uid() as current_user_id,
  auth.email() as current_user_email;

-- ============================================================
-- 1. CHECK TENANT AND USER DATA STRUCTURE
-- ============================================================

-- Check tenants table
SELECT 
  '1. TENANTS CHECK' as section,
  COUNT(*) as total_tenants,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_tenants
FROM public.tenants;

-- Sample tenant data
SELECT 
  '1a. SAMPLE TENANTS' as section,
  id,
  name,
  status,
  created_at
FROM public.tenants 
ORDER BY created_at DESC 
LIMIT 3;

-- Check users table structure and sample data
SELECT 
  '2. USERS TABLE CHECK' as section,
  COUNT(*) as total_users,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as users_with_tenant,
  COUNT(CASE WHEN linked_student_id IS NOT NULL THEN 1 END) as users_linked_to_students
FROM public.users;

-- Sample users with student links
SELECT 
  '2a. SAMPLE STUDENT-LINKED USERS' as section,
  u.id,
  u.email,
  u.full_name,
  u.tenant_id,
  u.linked_student_id,
  r.role_name
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.linked_student_id IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 5;

-- ============================================================
-- 2. CHECK STUDENT DATA AND CLASS RELATIONSHIPS
-- ============================================================

-- Check students table
SELECT 
  '3. STUDENTS TABLE CHECK' as section,
  COUNT(*) as total_students,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant,
  COUNT(CASE WHEN class_id IS NOT NULL THEN 1 END) as students_with_class
FROM public.students;

-- Sample students with class info
SELECT 
  '3a. SAMPLE STUDENTS WITH CLASSES' as section,
  s.id,
  s.name,
  s.admission_no,
  s.tenant_id,
  s.class_id,
  c.class_name,
  c.section,
  c.academic_year
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id
ORDER BY s.created_at DESC
LIMIT 5;

-- ============================================================
-- 3. CHECK FEE STRUCTURE DATA
-- ============================================================

-- Check fee_structure table
SELECT 
  '4. FEE STRUCTURE CHECK' as section,
  COUNT(*) as total_fee_structures,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as fee_structures_with_tenant,
  COUNT(CASE WHEN class_id IS NOT NULL AND student_id IS NULL THEN 1 END) as class_level_fees,
  COUNT(CASE WHEN student_id IS NOT NULL THEN 1 END) as student_specific_fees,
  ROUND(AVG(amount), 2) as average_fee_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM public.fee_structure;

-- Sample fee structures by type
SELECT 
  '4a. SAMPLE FEE STRUCTURES - CLASS LEVEL' as section,
  fs.id,
  fs.fee_component,
  fs.amount,
  fs.academic_year,
  fs.tenant_id,
  c.class_name,
  c.section
FROM public.fee_structure fs
LEFT JOIN public.classes c ON fs.class_id = c.id
WHERE fs.student_id IS NULL -- Class-level fees
ORDER BY fs.created_at DESC
LIMIT 5;

-- Sample fee structures - student specific
SELECT 
  '4b. SAMPLE FEE STRUCTURES - STUDENT SPECIFIC' as section,
  fs.id,
  fs.fee_component,
  fs.amount,
  fs.academic_year,
  fs.tenant_id,
  s.name as student_name,
  s.admission_no
FROM public.fee_structure fs
LEFT JOIN public.students s ON fs.student_id = s.id
WHERE fs.student_id IS NOT NULL -- Student-specific fees
ORDER BY fs.created_at DESC
LIMIT 5;

-- ============================================================
-- 4. CHECK STUDENT FEES (PAYMENTS) DATA
-- ============================================================

-- Check student_fees table (payments)
SELECT 
  '5. STUDENT FEES (PAYMENTS) CHECK' as section,
  COUNT(*) as total_payments,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as payments_with_tenant,
  ROUND(SUM(amount_paid), 2) as total_amount_paid,
  ROUND(AVG(amount_paid), 2) as average_payment,
  COUNT(DISTINCT student_id) as unique_students_with_payments
FROM public.student_fees;

-- Recent payments sample
SELECT 
  '5a. RECENT PAYMENTS SAMPLE' as section,
  sf.id,
  sf.student_id,
  sf.fee_component,
  sf.amount_paid,
  sf.payment_date,
  sf.payment_mode,
  sf.tenant_id,
  s.name as student_name
FROM public.student_fees sf
LEFT JOIN public.students s ON sf.student_id = s.id
ORDER BY sf.payment_date DESC, sf.created_at DESC
LIMIT 5;

-- ============================================================
-- 5. CHECK STUDENT DISCOUNTS
-- ============================================================

-- Check student_discounts table
SELECT 
  '6. STUDENT DISCOUNTS CHECK' as section,
  COUNT(*) as total_discounts,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_discounts,
  COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as discounts_with_tenant,
  COUNT(DISTINCT student_id) as students_with_discounts
FROM public.student_discounts;

-- Sample discounts
SELECT 
  '6a. SAMPLE DISCOUNTS' as section,
  sd.id,
  sd.student_id,
  sd.fee_component,
  sd.discount_type,
  sd.discount_value,
  sd.is_active,
  s.name as student_name
FROM public.student_discounts sd
LEFT JOIN public.students s ON sd.student_id = s.id
WHERE sd.is_active = true
ORDER BY sd.created_at DESC
LIMIT 5;

-- ============================================================
-- 6. CHECK RLS POLICIES ON KEY TABLES
-- ============================================================

-- Check RLS policies for fee-related tables
SELECT 
  '7. RLS POLICIES CHECK' as section,
  table_name as tablename,
  policy_name as policyname,
  permissive,
  roles,
  command as cmd,
  definition as qual
FROM pg_policies 
WHERE schema_name = 'public' 
  AND table_name IN ('fee_structure', 'student_fees', 'student_discounts', 'students', 'users', 'classes')
ORDER BY table_name, policy_name;

-- Check if RLS is enabled on key tables
SELECT 
  '7a. RLS ENABLED CHECK' as section,
  t.table_schema as schema_name,
  t.table_name as table_name,
  c.relrowsecurity as rls_enabled
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
  AND t.table_name IN ('fee_structure', 'student_fees', 'student_discounts', 'students', 'users', 'classes')
ORDER BY t.table_name;

-- ============================================================
-- 7. TEST EMAIL-BASED TENANT LOOKUP
-- ============================================================

-- Test tenant lookup by email for any user
WITH sample_user AS (
  SELECT id, email, tenant_id, linked_student_id
  FROM public.users 
  WHERE linked_student_id IS NOT NULL 
  LIMIT 1
)
SELECT 
  '8. EMAIL-BASED TENANT LOOKUP TEST' as section,
  su.email as test_user_email,
  su.tenant_id as user_tenant_id,
  t.name as tenant_name,
  t.status as tenant_status,
  su.linked_student_id as linked_student_id
FROM sample_user su
LEFT JOIN public.tenants t ON su.tenant_id = t.id;

-- ============================================================
-- 8. SPECIFIC STUDENT FEE CALCULATION TEST
-- ============================================================

-- Test fee calculation for a specific student
WITH test_student AS (
  SELECT s.id, s.name, s.class_id, s.tenant_id, s.academic_year
  FROM public.students s
  WHERE s.tenant_id IS NOT NULL AND s.class_id IS NOT NULL
  LIMIT 1
),
class_fees AS (
  SELECT 
    ts.id as student_id,
    fs.fee_component,
    fs.amount as base_amount,
    fs.tenant_id
  FROM test_student ts
  JOIN public.fee_structure fs ON fs.class_id = ts.class_id 
    AND fs.academic_year = ts.academic_year 
    AND fs.tenant_id = ts.tenant_id
    AND fs.student_id IS NULL -- Class-level fees only
),
student_payments AS (
  SELECT 
    cf.student_id,
    cf.fee_component,
    COALESCE(SUM(sf.amount_paid), 0) as total_paid
  FROM class_fees cf
  LEFT JOIN public.student_fees sf ON sf.student_id = cf.student_id 
    AND sf.fee_component = cf.fee_component
    AND sf.tenant_id = cf.tenant_id
  GROUP BY cf.student_id, cf.fee_component
),
student_discounts AS (
  SELECT 
    cf.student_id,
    cf.fee_component,
    COALESCE(
      CASE sd.discount_type
        WHEN 'percentage' THEN cf.base_amount * (sd.discount_value / 100.0)
        WHEN 'fixed_amount' THEN sd.discount_value
        ELSE 0
      END, 0
    ) as discount_amount
  FROM class_fees cf
  LEFT JOIN public.student_discounts sd ON sd.student_id = cf.student_id 
    AND (sd.fee_component = cf.fee_component OR sd.fee_component IS NULL)
    AND sd.is_active = true
    AND sd.tenant_id = cf.tenant_id
)
SELECT 
  '9. STUDENT FEE CALCULATION TEST' as section,
  ts.name as student_name,
  cf.fee_component,
  cf.base_amount,
  COALESCE(sd.discount_amount, 0) as discount_amount,
  (cf.base_amount - COALESCE(sd.discount_amount, 0)) as final_amount,
  COALESCE(sp.total_paid, 0) as paid_amount,
  (cf.base_amount - COALESCE(sd.discount_amount, 0) - COALESCE(sp.total_paid, 0)) as outstanding
FROM test_student ts
JOIN class_fees cf ON cf.student_id = ts.id
LEFT JOIN student_payments sp ON sp.student_id = cf.student_id AND sp.fee_component = cf.fee_component
LEFT JOIN student_discounts sd ON sd.student_id = cf.student_id AND sd.fee_component = cf.fee_component;

-- ============================================================
-- 9. PERMISSION AND ACCESS TEST
-- ============================================================

-- Test table permissions
SELECT 
  '10. TABLE PERMISSIONS CHECK' as section,
  table_schema as schema_name,
  table_name,
  grantor,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_schema = 'public' 
  AND table_name IN ('fee_structure', 'student_fees', 'student_discounts')
  AND grantee IN ('authenticated', 'public')
ORDER BY table_name, privilege_type;

COMMIT;

-- ============================================================
-- SUMMARY AND RECOMMENDATIONS
-- ============================================================

SELECT 
  '=== DIAGNOSTIC COMPLETE ===' as section,
  'Review the results above to identify issues' as message,
  'Common issues: Missing tenant_id, incorrect RLS policies, no fee data, permission problems' as common_problems,
  'Next step: Run the fix_student_fee_rls_and_data.sql script' as next_action;
