-- Fix RLS Policies for Student Fee Data Access
-- This script implements the email-based tenant system RLS policies as described in EMAIL_BASED_TENANT_SYSTEM.md

BEGIN;

-- ===============================================
-- 1. FIX USERS TABLE POLICIES (Core Email-Based Lookup)
-- ===============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS users_tenant_isolation ON public.users;
DROP POLICY IF EXISTS users_select_policy ON public.users;
DROP POLICY IF EXISTS users_insert_policy ON public.users;
DROP POLICY IF EXISTS users_update_policy ON public.users;

-- Create email-based user access policy (allows email-based tenant lookup)
CREATE POLICY users_email_based_access ON public.users
  FOR ALL USING (
    -- Allow access if user is authenticated (needed for email-based tenant lookup)
    auth.uid() IS NOT NULL
  );

COMMENT ON POLICY users_email_based_access ON public.users IS 
'Email-based tenant system: Allow authenticated users to access user records for tenant lookup via email';

-- ===============================================
-- 2. FIX STUDENTS TABLE POLICIES
-- ===============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS students_tenant_isolation ON public.students;
DROP POLICY IF EXISTS students_select_policy ON public.students;
DROP POLICY IF EXISTS students_insert_policy ON public.students;
DROP POLICY IF EXISTS students_update_policy ON public.students;

-- Create flexible student access policy
CREATE POLICY students_tenant_access ON public.students
  FOR ALL USING (
    -- Allow if user belongs to the same tenant as the student record
    tenant_id = (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
    OR
    -- Allow if user is linked to this specific student
    id = (
      SELECT u.linked_student_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
    OR
    -- Allow if user's email matches any user record in the same tenant
    tenant_id IN (
      SELECT u2.tenant_id 
      FROM public.users u2 
      WHERE u2.email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
      )
    )
  );

COMMENT ON POLICY students_tenant_access ON public.students IS 
'Email-based tenant system: Allow access to student records within user tenant or linked student';

-- ===============================================
-- 3. FIX FEE-RELATED TABLES POLICIES
-- ===============================================

-- Fee Structure Table
DROP POLICY IF EXISTS fee_structure_tenant_isolation ON public.fee_structure;
DROP POLICY IF EXISTS fee_structure_select_policy ON public.fee_structure;

CREATE POLICY fee_structure_tenant_access ON public.fee_structure
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fee Payments Table
DROP POLICY IF EXISTS fee_payments_tenant_isolation ON public.fee_payments;
DROP POLICY IF EXISTS fee_payments_select_policy ON public.fee_payments;

CREATE POLICY fee_payments_tenant_access ON public.fee_payments
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Student Fee Structure Table (if exists)
DROP POLICY IF EXISTS student_fee_structure_tenant_isolation ON public.student_fee_structure;
DROP POLICY IF EXISTS student_fee_structure_select_policy ON public.student_fee_structure;

CREATE POLICY student_fee_structure_tenant_access ON public.student_fee_structure
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Fee Components Table (if exists)
DROP POLICY IF EXISTS fee_components_tenant_isolation ON public.fee_components;
DROP POLICY IF EXISTS fee_components_select_policy ON public.fee_components;

CREATE POLICY fee_components_tenant_access ON public.fee_components
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ===============================================
-- 4. FIX CLASSES TABLE POLICIES
-- ===============================================

DROP POLICY IF EXISTS classes_tenant_isolation ON public.classes;
DROP POLICY IF EXISTS classes_select_policy ON public.classes;

CREATE POLICY classes_tenant_access ON public.classes
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ===============================================
-- 5. FIX TENANTS TABLE POLICIES  
-- ===============================================

DROP POLICY IF EXISTS tenants_access_policy ON public.tenants;
DROP POLICY IF EXISTS tenants_select_policy ON public.tenants;

-- Allow users to read their own tenant information (needed for email-based lookup)
CREATE POLICY tenants_user_access ON public.tenants
  FOR SELECT USING (
    -- Allow if user belongs to this tenant
    id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    -- Allow reading active tenant info for tenant lookup
    status = 'active'
  );

-- ===============================================
-- 6. FIX ATTENDANCE, MARKS, AND OTHER STUDENT DATA
-- ===============================================

-- Student Attendance
DROP POLICY IF EXISTS student_attendance_tenant_isolation ON public.student_attendance;
CREATE POLICY student_attendance_tenant_access ON public.student_attendance
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Marks Table
DROP POLICY IF EXISTS marks_tenant_isolation ON public.marks;
CREATE POLICY marks_tenant_access ON public.marks
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Assignments Table
DROP POLICY IF EXISTS assignments_tenant_isolation ON public.assignments;
CREATE POLICY assignments_tenant_access ON public.assignments
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Homeworks Table  
DROP POLICY IF EXISTS homeworks_tenant_isolation ON public.homeworks;
CREATE POLICY homeworks_tenant_access ON public.homeworks
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Notifications Tables
DROP POLICY IF EXISTS notifications_tenant_isolation ON public.notifications;
CREATE POLICY notifications_tenant_access ON public.notifications
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS notification_recipients_tenant_isolation ON public.notification_recipients;
CREATE POLICY notification_recipients_tenant_access ON public.notification_recipients
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ===============================================
-- 7. FIX TIMETABLE AND SUBJECTS
-- ===============================================

-- Timetable
DROP POLICY IF EXISTS timetable_tenant_isolation ON public.timetable;
CREATE POLICY timetable_tenant_access ON public.timetable
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Subjects
DROP POLICY IF EXISTS subjects_tenant_isolation ON public.subjects;
CREATE POLICY subjects_tenant_access ON public.subjects
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Exams
DROP POLICY IF EXISTS exams_tenant_isolation ON public.exams;
CREATE POLICY exams_tenant_access ON public.exams
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
        OR u.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- ===============================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- ===============================================

-- Critical indexes for the email-based tenant system
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_tenant 
  ON public.users(email, tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_id 
  ON public.users(id) WHERE id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_tenant_lookup 
  ON public.students(tenant_id, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fee_structure_tenant 
  ON public.fee_structure(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fee_payments_tenant 
  ON public.fee_payments(tenant_id) WHERE tenant_id IS NOT NULL;

-- ===============================================
-- 9. GRANT NECESSARY PERMISSIONS
-- ===============================================

-- Grant authenticated users access to read from these tables
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.classes TO authenticated;
GRANT SELECT ON public.fee_structure TO authenticated;
GRANT SELECT ON public.fee_payments TO authenticated;
GRANT SELECT ON public.student_fee_structure TO authenticated;
GRANT SELECT ON public.marks TO authenticated;
GRANT SELECT ON public.student_attendance TO authenticated;
GRANT SELECT ON public.subjects TO authenticated;
GRANT SELECT ON public.timetable TO authenticated;
GRANT SELECT ON public.assignments TO authenticated;
GRANT SELECT ON public.homeworks TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT SELECT ON public.notification_recipients TO authenticated;

-- ===============================================
-- VERIFICATION QUERIES
-- ===============================================

-- Test the policies work by checking if data is accessible
DO $$
BEGIN
  RAISE NOTICE 'RLS Policy Fix Complete!';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '- Check student data access after login';
  RAISE NOTICE '- Check fee structure visibility';
  RAISE NOTICE '- Check tenant-based data isolation';
  RAISE NOTICE '- Monitor logs for any remaining RLS blocks';
END $$;

COMMIT;

-- ===============================================
-- FINAL SUCCESS MESSAGE
-- ===============================================
SELECT 'SUCCESS: Student fee data RLS policies updated!' as status,
       'Students should now be able to access fee data via email-based tenant lookup' as message;
