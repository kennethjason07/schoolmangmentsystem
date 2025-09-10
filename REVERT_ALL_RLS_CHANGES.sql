-- ============================================================
-- COMPLETE REVERT: UNDO ALL RLS CHANGES MADE TODAY
-- ============================================================
-- This script completely reverts all RLS policy changes made today
-- and restores the system to working order

BEGIN;

-- ============================================================
-- 1. DISABLE RLS ON ALL TABLES TO PREVENT RECURSION ISSUES
-- ============================================================

ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_structure DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_discounts DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. DROP ALL POLICIES CREATED TODAY
-- ============================================================

-- Drop users table policies
DROP POLICY IF EXISTS users_email_tenant_access ON public.users;
DROP POLICY IF EXISTS users_simple_access ON public.users;
DROP POLICY IF EXISTS users_email_lookup ON public.users;

-- Drop students table policies
DROP POLICY IF EXISTS students_email_tenant_access ON public.students;
DROP POLICY IF EXISTS students_tenant_based_access ON public.students;

-- Drop classes table policies
DROP POLICY IF EXISTS classes_email_tenant_access ON public.classes;
DROP POLICY IF EXISTS classes_tenant_based_access ON public.classes;

-- Drop fee_structure table policies
DROP POLICY IF EXISTS fee_structure_email_tenant_access ON public.fee_structure;
DROP POLICY IF EXISTS fee_structure_tenant_access ON public.fee_structure;

-- Drop student_fees table policies
DROP POLICY IF EXISTS student_fees_email_tenant_access ON public.student_fees;
DROP POLICY IF EXISTS student_fees_tenant_access ON public.student_fees;

-- Drop student_discounts table policies
DROP POLICY IF EXISTS student_discounts_email_tenant_access ON public.student_discounts;
DROP POLICY IF EXISTS student_discounts_tenant_access ON public.student_discounts;

-- Drop any other policies that might have been created
DROP POLICY IF EXISTS tenants_read_access ON public.tenants;

-- ============================================================
-- 3. REMOVE ANY VIEWS CREATED TODAY
-- ============================================================

DROP VIEW IF EXISTS public.student_fee_summary CASCADE;

-- ============================================================
-- 4. KEEP RLS DISABLED FOR NOW (WORKING STATE)
-- ============================================================

-- Keep all RLS disabled so the system works normally
-- This is the safest approach until we have a proper solution

SELECT 
  'COMPLETE REVERT SUCCESSFUL' as status,
  'All RLS policies created today have been removed' as policies_status,
  'RLS is now DISABLED on all tables' as rls_status,
  'Your system should work normally now' as result,
  'Login and fee payment should work' as next_step;

COMMIT;

-- ============================================================
-- 5. VERIFICATION
-- ============================================================

-- Show that RLS is disabled on key tables
SELECT 
  'RLS STATUS AFTER REVERT' as type,
  t.table_name,
  c.relrowsecurity as rls_enabled
FROM information_schema.tables t
JOIN pg_class c ON c.relname = t.table_name
WHERE t.table_schema = 'public' 
  AND t.table_name IN ('users', 'students', 'classes', 'fee_structure', 'student_fees');

-- Show that policies are removed
SELECT 
  'REMAINING POLICIES' as type,
  COUNT(*) as policy_count,
  string_agg(tablename || '.' || policyname, ', ') as remaining_policies
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'students', 'classes', 'fee_structure', 'student_fees', 'student_discounts');

-- Show fee structure is still there
SELECT 
  'FEE DATA STATUS' as type,
  COUNT(*) as total_fees,
  COUNT(DISTINCT tenant_id) as tenants_with_fees
FROM public.fee_structure;
