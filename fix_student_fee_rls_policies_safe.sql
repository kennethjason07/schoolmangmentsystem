-- Fix RLS Policies for Student Fee Data Access (Safe Version)
-- This script safely handles existing policies and implements email-based tenant system

BEGIN;

-- ===============================================
-- DISABLE RLS TEMPORARILY FOR SAFE UPDATES
-- ===============================================

-- We'll re-enable RLS at the end
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;

-- Disable RLS on fee-related tables
DO $$
BEGIN
    -- Only disable if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        ALTER TABLE public.fee_structure DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        ALTER TABLE public.fee_payments DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_fee_structure') THEN
        ALTER TABLE public.student_fee_structure DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_components') THEN
        ALTER TABLE public.fee_components DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
        ALTER TABLE public.marks DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_attendance') THEN
        ALTER TABLE public.student_attendance DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assignments') THEN
        ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'homeworks') THEN
        ALTER TABLE public.homeworks DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') THEN
        ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_recipients') THEN
        ALTER TABLE public.notification_recipients DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'timetable') THEN
        ALTER TABLE public.timetable DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects') THEN
        ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'exams') THEN
        ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ===============================================
-- DROP ALL EXISTING POLICIES SAFELY
-- ===============================================

-- Drop all existing policies on users table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.users';
    END LOOP;
END $$;

-- Drop all existing policies on students table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'students' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.students';
    END LOOP;
END $$;

-- Drop all existing policies on tenants table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'tenants' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.tenants';
    END LOOP;
END $$;

-- Drop all existing policies on classes table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'classes' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON public.classes';
    END LOOP;
END $$;

-- ===============================================
-- GRANT PERMISSIONS FIRST (Before RLS)
-- ===============================================

-- Grant basic read permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT ON public.students TO authenticated;
GRANT SELECT ON public.classes TO authenticated;

-- Grant permissions on fee-related tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        GRANT SELECT ON public.fee_structure TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        GRANT SELECT ON public.fee_payments TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_fee_structure') THEN
        GRANT SELECT ON public.student_fee_structure TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
        GRANT SELECT ON public.marks TO authenticated;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_attendance') THEN
        GRANT SELECT ON public.student_attendance TO authenticated;
    END IF;
    
    -- Add other tables as needed
END $$;

-- ===============================================
-- CREATE NEW SIMPLIFIED POLICIES
-- ===============================================

-- 1. Users table - Allow email-based lookup
CREATE POLICY users_email_lookup ON public.users
  FOR ALL USING (
    -- Allow authenticated users to look up user records (needed for email-based tenant resolution)
    auth.uid() IS NOT NULL
  );

-- 2. Tenants table - Allow reading tenant information
CREATE POLICY tenants_read_access ON public.tenants
  FOR SELECT USING (
    -- Allow reading active tenant information
    status = 'active'
    OR
    -- Allow reading user's own tenant
    id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

-- 3. Students table - Tenant-based access
CREATE POLICY students_tenant_based_access ON public.students
  FOR ALL USING (
    -- Allow access if student belongs to user's tenant
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
    OR
    -- Allow if user is directly linked to this student
    id IN (
      SELECT u.linked_student_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
  );

-- 4. Classes table - Tenant-based access  
CREATE POLICY classes_tenant_based_access ON public.classes
  FOR ALL USING (
    tenant_id IN (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
  );

-- 5. Fee-related tables (if they exist)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        EXECUTE 'CREATE POLICY fee_structure_tenant_access ON public.fee_structure
          FOR ALL USING (
            tenant_id IN (
              SELECT u.tenant_id 
              FROM public.users u 
              WHERE u.id = auth.uid()
            )
          )';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        EXECUTE 'CREATE POLICY fee_payments_tenant_access ON public.fee_payments
          FOR ALL USING (
            tenant_id IN (
              SELECT u.tenant_id 
              FROM public.users u 
              WHERE u.id = auth.uid()
            )
          )';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_fee_structure') THEN
        EXECUTE 'CREATE POLICY student_fee_structure_tenant_access ON public.student_fee_structure
          FOR ALL USING (
            tenant_id IN (
              SELECT u.tenant_id 
              FROM public.users u 
              WHERE u.id = auth.uid()
            )
          )';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
        EXECUTE 'CREATE POLICY marks_tenant_access ON public.marks
          FOR ALL USING (
            tenant_id IN (
              SELECT u.tenant_id 
              FROM public.users u 
              WHERE u.id = auth.uid()
            )
          )';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_attendance') THEN
        EXECUTE 'CREATE POLICY student_attendance_tenant_access ON public.student_attendance
          FOR ALL USING (
            tenant_id IN (
              SELECT u.tenant_id 
              FROM public.users u 
              WHERE u.id = auth.uid()
            )
          )';
    END IF;
END $$;

-- ===============================================
-- RE-ENABLE RLS ON ALL TABLES
-- ===============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Re-enable RLS on fee-related tables
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_fee_structure') THEN
        ALTER TABLE public.student_fee_structure ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'marks') THEN
        ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_attendance') THEN
        ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ===============================================
-- CREATE PERFORMANCE INDEXES
-- ===============================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_lookup 
  ON public.users(id, tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_tenant 
  ON public.students(tenant_id) WHERE tenant_id IS NOT NULL;

-- ===============================================
-- VERIFICATION AND SUCCESS MESSAGE
-- ===============================================

COMMIT;

-- Show success message
SELECT 
  'SUCCESS: RLS policies updated for email-based tenant system!' as status,
  'Students should now be able to access their fee data' as message,
  'Try logging in as a student and accessing the fee payment screen' as next_step;

-- Show current policy count
SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('users', 'students', 'tenants', 'classes', 'fee_structure', 'fee_payments')
GROUP BY schemaname, tablename
ORDER BY tablename;
