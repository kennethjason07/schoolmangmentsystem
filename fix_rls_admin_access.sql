-- Fix RLS Policies for Admin Access
-- This script adds proper RLS policies for multi-tenant data access
-- Allowing admin users to access data across tenants when needed

-- =======================
-- STEP 1: Enable RLS on all tables
-- =======================

-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Enable RLS on all tables (if not already enabled)
-- Note: This is just a template - don't run this on all tables blindly
-- ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
-- (etc. for other tables)

-- =======================
-- STEP 2: Create universal tenant isolation policy
-- =======================

-- First, let's add a helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the current user has role_id = 1 (admin)
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() 
    AND role_id = 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Then create tenant isolation policies for each table

-- Students table
DROP POLICY IF EXISTS students_tenant_isolation ON public.students;
CREATE POLICY students_tenant_isolation ON public.students
USING (
  -- Allow if tenant_id matches user's tenant_id OR user is admin
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Teachers table
DROP POLICY IF EXISTS teachers_tenant_isolation ON public.teachers;
CREATE POLICY teachers_tenant_isolation ON public.teachers
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Classes table
DROP POLICY IF EXISTS classes_tenant_isolation ON public.classes;
CREATE POLICY classes_tenant_isolation ON public.classes
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Assignments table
DROP POLICY IF EXISTS assignments_tenant_isolation ON public.assignments;
CREATE POLICY assignments_tenant_isolation ON public.assignments
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Subjects table
DROP POLICY IF EXISTS subjects_tenant_isolation ON public.subjects;
CREATE POLICY subjects_tenant_isolation ON public.subjects
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Exams table
DROP POLICY IF EXISTS exams_tenant_isolation ON public.exams;
CREATE POLICY exams_tenant_isolation ON public.exams
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Marks table
DROP POLICY IF EXISTS marks_tenant_isolation ON public.marks;
CREATE POLICY marks_tenant_isolation ON public.marks
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Fee Structure table
DROP POLICY IF EXISTS fee_structure_tenant_isolation ON public.fee_structure;
CREATE POLICY fee_structure_tenant_isolation ON public.fee_structure
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Student Fees table
DROP POLICY IF EXISTS student_fees_tenant_isolation ON public.student_fees;
CREATE POLICY student_fees_tenant_isolation ON public.student_fees
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- Events table
DROP POLICY IF EXISTS events_tenant_isolation ON public.events;
CREATE POLICY events_tenant_isolation ON public.events
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  OR (SELECT is_admin())
);

-- =======================
-- STEP 3: Special policies for core system tables
-- =======================

-- Users table - special policy needed for authentication
DROP POLICY IF EXISTS users_tenant_isolation ON public.users;
CREATE POLICY users_tenant_isolation ON public.users
USING (
  -- Users can access their own record
  id = auth.uid()
  -- Users can access records in their tenant
  OR tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  -- Admin users can access all records
  OR (SELECT is_admin())
);

-- Roles table - accessible by all authenticated users
DROP POLICY IF EXISTS roles_read_access ON public.roles;
CREATE POLICY roles_read_access ON public.roles
FOR SELECT
USING (true);

-- Tenants table - admin-only access except for own tenant
DROP POLICY IF EXISTS tenants_tenant_isolation ON public.tenants;
CREATE POLICY tenants_tenant_isolation ON public.tenants
USING (
  -- Users can access their own tenant
  id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  -- Admin users can access all tenants
  OR (SELECT is_admin())
);

-- =======================
-- STEP 4: Verify policies are in place
-- =======================

-- Check policies for a specific table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users';

-- Check all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
