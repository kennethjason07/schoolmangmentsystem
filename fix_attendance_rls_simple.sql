-- Fix Attendance Management RLS Policies (Simple Approach)
-- This script fixes RLS policies specifically for attendance tables without breaking existing ones
-- Run this in Supabase SQL Editor

-- ==========================================
-- STEP 1: Check current status
-- ==========================================
SELECT 'Checking attendance tables RLS status...' as info;

SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public' 
AND tablename IN ('student_attendance', 'teacher_attendance')
ORDER BY tablename;

-- ==========================================
-- STEP 2: Drop only attendance-specific policies
-- ==========================================
SELECT 'Dropping existing attendance policies...' as info;

-- Drop all existing attendance policies (but keep other table policies intact)
DROP POLICY IF EXISTS "student_attendance_tenant_isolation" ON public.student_attendance;
DROP POLICY IF EXISTS "teacher_attendance_tenant_isolation" ON public.teacher_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_select" ON public.student_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_insert" ON public.student_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_update" ON public.student_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_select" ON public.teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_insert" ON public.teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_update" ON public.teacher_attendance;
DROP POLICY IF EXISTS "student_attendance_tenant_access" ON public.student_attendance;
DROP POLICY IF EXISTS "teacher_attendance_tenant_access" ON public.teacher_attendance;

-- Drop any other attendance-related policies
DROP POLICY IF EXISTS "student_attendance_select" ON public.student_attendance;
DROP POLICY IF EXISTS "student_attendance_insert" ON public.student_attendance;
DROP POLICY IF EXISTS "student_attendance_update" ON public.student_attendance;
DROP POLICY IF EXISTS "student_attendance_delete" ON public.student_attendance;
DROP POLICY IF EXISTS "teacher_attendance_select" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_insert" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_update" ON public.teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_delete" ON public.teacher_attendance;

-- ==========================================
-- STEP 3: Enable RLS on attendance tables
-- ==========================================
SELECT 'Enabling RLS on attendance tables...' as info;

ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 4: Create very permissive policies for attendance
-- ==========================================
SELECT 'Creating permissive attendance policies...' as info;

-- Use the existing get_current_user_tenant_id() function that's already there

-- Student Attendance Policies - Very permissive for now
CREATE POLICY "student_attendance_permissive" ON public.student_attendance
  FOR ALL TO authenticated 
  USING (
    -- Allow access if user is in same tenant (using existing function)
    tenant_id = public.get_current_user_tenant_id()
    OR
    -- Allow access if tenant_id is null (for migration/setup)
    tenant_id IS NULL
    OR
    -- Allow access if user's tenant_id is null (for migration/setup)
    public.get_current_user_tenant_id() IS NULL
    OR
    -- Allow if both are null
    (tenant_id IS NULL AND public.get_current_user_tenant_id() IS NULL)
  )
  WITH CHECK (
    -- For INSERT/UPDATE, allow if tenant matches or is null
    tenant_id = public.get_current_user_tenant_id()
    OR
    tenant_id IS NULL
    OR
    public.get_current_user_tenant_id() IS NULL
  );

-- Teacher Attendance Policies - Very permissive for now
CREATE POLICY "teacher_attendance_permissive" ON public.teacher_attendance
  FOR ALL TO authenticated 
  USING (
    -- Allow access if user is in same tenant (using existing function)
    tenant_id = public.get_current_user_tenant_id()
    OR
    -- Allow access if tenant_id is null (for migration/setup)
    tenant_id IS NULL
    OR
    -- Allow access if user's tenant_id is null (for migration/setup)
    public.get_current_user_tenant_id() IS NULL
    OR
    -- Allow if both are null
    (tenant_id IS NULL AND public.get_current_user_tenant_id() IS NULL)
  )
  WITH CHECK (
    -- For INSERT/UPDATE, allow if tenant matches or is null
    tenant_id = public.get_current_user_tenant_id()
    OR
    tenant_id IS NULL
    OR
    public.get_current_user_tenant_id() IS NULL
  );

-- ==========================================
-- STEP 5: Create trigger to auto-set tenant_id on insert (if not set)
-- ==========================================
SELECT 'Creating tenant_id auto-assignment triggers...' as info;

-- Function to automatically set tenant_id on insert
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set tenant_id if not already set
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_current_user_tenant_id();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for attendance tables
DROP TRIGGER IF EXISTS auto_set_student_attendance_tenant_id ON public.student_attendance;
CREATE TRIGGER auto_set_student_attendance_tenant_id
  BEFORE INSERT ON public.student_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_teacher_attendance_tenant_id ON public.teacher_attendance;
CREATE TRIGGER auto_set_teacher_attendance_tenant_id
  BEFORE INSERT ON public.teacher_attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

-- ==========================================
-- STEP 6: Show current policies status
-- ==========================================
SELECT 'Current Attendance Policies:' as info;

SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as operation,
    permissive,
    roles
FROM pg_policies 
WHERE tablename IN ('student_attendance', 'teacher_attendance')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- ==========================================
-- STEP 7: Test current user context
-- ==========================================
SELECT 'Current User Context:' as info;

SELECT 
    'Current auth.uid(): ' || COALESCE(auth.uid()::text, 'NULL') as current_user,
    'JWT tenant_id: ' || COALESCE((auth.jwt() ->> 'tenant_id'), 'NULL') as jwt_tenant,
    'Function result: ' || COALESCE(public.get_current_user_tenant_id()::text, 'NULL') as function_result;

-- Check if there are users in the users table
SELECT 'Users table info:' as info;
SELECT 
    COUNT(*) as total_users,
    COUNT(DISTINCT tenant_id) as distinct_tenants,
    array_agg(DISTINCT tenant_id::text) as tenant_list
FROM public.users
WHERE tenant_id IS NOT NULL;

-- ==========================================
-- STEP 8: Test attendance table access
-- ==========================================
SELECT 'Testing attendance table access...' as info;

-- Test if we can read from attendance tables
SELECT 
    'student_attendance' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT tenant_id) as distinct_tenants
FROM public.student_attendance
UNION ALL
SELECT 
    'teacher_attendance' as table_name,
    COUNT(*) as total_records,
    COUNT(DISTINCT tenant_id) as distinct_tenants
FROM public.teacher_attendance;

-- ==========================================
-- STEP 9: Success message
-- ==========================================
SELECT '✅ Attendance RLS policies have been updated!' as completion_status;
SELECT '🎯 Policies are now very permissive to allow data access during setup!' as details;
SELECT '📝 Triggers will auto-set tenant_id on insert if not provided!' as trigger_info;
SELECT '⚠️ Make sure to test insertion now!' as next_step;

-- ==========================================
-- STEP 10: Alternative emergency policy (if still issues)
-- ==========================================
-- Uncomment these lines if you still have issues:

/*
-- Emergency: Very permissive policies that allow almost everything
DROP POLICY IF EXISTS "student_attendance_permissive" ON public.student_attendance;
DROP POLICY IF EXISTS "teacher_attendance_permissive" ON public.teacher_attendance;

CREATE POLICY "student_attendance_emergency" ON public.student_attendance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "teacher_attendance_emergency" ON public.teacher_attendance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT '🚨 Emergency policies created - all authenticated users can access attendance data!' as emergency_status;
*/
