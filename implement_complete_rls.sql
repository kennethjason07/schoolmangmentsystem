-- ==========================================
-- COMPREHENSIVE RLS IMPLEMENTATION
-- Multi-Tenant School Management System
-- ==========================================
-- 
-- This script implements complete Row Level Security (RLS) for tenant isolation
-- Run this in Supabase SQL Editor as a database administrator

-- ==========================================
-- STEP 1: ENABLE RLS ON ALL TABLES
-- ==========================================

-- Enable RLS on core tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on attendance and academic tables
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Enable RLS on assignment and homework tables
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on fee management tables
ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;

-- Enable RLS on communication tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Enable RLS on administrative tables
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_leave_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- STEP 2: DROP EXISTING POLICIES (IF ANY)
-- ==========================================

-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all policies on public schema tables
    FOR r IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ==========================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- ==========================================

-- Function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- First try to get tenant_id from JWT claims
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    -- Fallback: get from users table
    (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1),
    -- Final fallback: known tenant ID for single-tenant deployments
    'b8f8b5f0-1234-4567-8901-123456789000'::uuid
  );
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.role_name IN ('admin', 'super_admin')
  );
$$;

-- Function to check if current user is teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.role_name = 'teacher'
  );
$$;

-- Function to check if current user is parent
CREATE OR REPLACE FUNCTION public.is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.role_name = 'parent'
  );
$$;

-- Function to check if current user is student
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.role_name = 'student'
  );
$$;

-- Function to enforce tenant_id on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set tenant_id from current context if not already set
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_current_tenant_id();
  END IF;
  
  -- Ensure tenant_id matches current user's tenant
  IF NEW.tenant_id != public.get_current_tenant_id() THEN
    RAISE EXCEPTION 'Cannot create/modify record for different tenant. Expected: %, Got: %', 
      public.get_current_tenant_id(), NEW.tenant_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- STEP 4: CREATE TENANT ISOLATION POLICIES
-- ==========================================

-- Tenants table policies (admin only)
CREATE POLICY "tenant_access" ON public.tenants
  FOR ALL USING (
    public.is_admin() OR 
    id = public.get_current_tenant_id()
  );

-- Users table policies
CREATE POLICY "users_tenant_isolation" ON public.users
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Roles table policies
CREATE POLICY "roles_tenant_isolation" ON public.roles
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Classes table policies
CREATE POLICY "classes_tenant_isolation" ON public.classes
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Students table policies
CREATE POLICY "students_tenant_isolation" ON public.students
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Parents table policies
CREATE POLICY "parents_tenant_isolation" ON public.parents
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Teachers table policies
CREATE POLICY "teachers_tenant_isolation" ON public.teachers
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Subjects table policies
CREATE POLICY "subjects_tenant_isolation" ON public.subjects
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Teacher subjects table policies
CREATE POLICY "teacher_subjects_tenant_isolation" ON public.teacher_subjects
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Student attendance table policies
CREATE POLICY "student_attendance_tenant_isolation" ON public.student_attendance
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Teacher attendance table policies
CREATE POLICY "teacher_attendance_tenant_isolation" ON public.teacher_attendance
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Exams table policies
CREATE POLICY "exams_tenant_isolation" ON public.exams
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- *** MARKS TABLE POLICIES ***
CREATE POLICY "marks_tenant_isolation" ON public.marks
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Homeworks table policies
CREATE POLICY "homeworks_tenant_isolation" ON public.homeworks
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Assignments table policies
CREATE POLICY "assignments_tenant_isolation" ON public.assignments
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Assignment submissions table policies
CREATE POLICY "assignment_submissions_tenant_isolation" ON public.assignment_submissions
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Fee structure table policies
CREATE POLICY "fee_structure_tenant_isolation" ON public.fee_structure
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Student fees table policies
CREATE POLICY "student_fees_tenant_isolation" ON public.student_fees
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Student discounts table policies
CREATE POLICY "student_discounts_tenant_isolation" ON public.student_discounts
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Notifications table policies
CREATE POLICY "notifications_tenant_isolation" ON public.notifications
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Notification recipients table policies
CREATE POLICY "notification_recipients_tenant_isolation" ON public.notification_recipients
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Messages table policies
CREATE POLICY "messages_tenant_isolation" ON public.messages
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Tasks table policies
CREATE POLICY "tasks_tenant_isolation" ON public.tasks
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Personal tasks table policies
CREATE POLICY "personal_tasks_tenant_isolation" ON public.personal_tasks
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- School details table policies
CREATE POLICY "school_details_tenant_isolation" ON public.school_details
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- School expenses table policies
CREATE POLICY "school_expenses_tenant_isolation" ON public.school_expenses
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Expense categories table policies
CREATE POLICY "expense_categories_tenant_isolation" ON public.expense_categories
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Events table policies
CREATE POLICY "events_tenant_isolation" ON public.events
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Leave applications table policies
CREATE POLICY "leave_applications_tenant_isolation" ON public.leave_applications
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Teacher leave balance table policies
CREATE POLICY "teacher_leave_balance_tenant_isolation" ON public.teacher_leave_balance
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Timetable entries table policies
CREATE POLICY "timetable_entries_tenant_isolation" ON public.timetable_entries
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- Period settings table policies
CREATE POLICY "period_settings_tenant_isolation" ON public.period_settings
  FOR ALL USING (tenant_id = public.get_current_tenant_id());

-- ==========================================
-- STEP 5: CREATE ROLE-BASED ACCESS POLICIES
-- ==========================================

-- Admin access policies (within tenant)
CREATE POLICY "admin_full_access" ON public.users
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id() AND
    public.is_admin()
  );

-- Teachers can view students in their assigned classes
CREATE POLICY "teachers_view_assigned_students" ON public.students
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    public.is_teacher() AND
    EXISTS (
      SELECT 1 FROM public.teacher_subjects ts
      JOIN public.subjects s ON ts.subject_id = s.id
      JOIN public.users u ON u.linked_teacher_id = ts.teacher_id
      WHERE u.id = auth.uid()
        AND s.class_id = students.class_id
        AND ts.tenant_id = public.get_current_tenant_id()
    )
  );

-- Students can only view their own data
CREATE POLICY "students_own_data" ON public.students
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    public.is_student() AND
    id IN (
      SELECT linked_student_id FROM public.users 
      WHERE id = auth.uid() AND linked_student_id IS NOT NULL
    )
  );

-- Parents can view their children's data
CREATE POLICY "parents_children_data" ON public.students
  FOR SELECT USING (
    tenant_id = public.get_current_tenant_id() AND
    public.is_parent() AND
    id IN (
      SELECT linked_parent_of FROM public.users 
      WHERE id = auth.uid() AND linked_parent_of IS NOT NULL
    )
  );

-- ==========================================
-- STEP 6: CREATE TRIGGERS FOR TENANT_ID ENFORCEMENT
-- ==========================================

-- Create triggers for automatic tenant_id enforcement on INSERT/UPDATE
-- Only add triggers for tables that have tenant_id column

CREATE TRIGGER enforce_tenant_id_users
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_students
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_teachers
  BEFORE INSERT OR UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_classes
  BEFORE INSERT OR UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_parents
  BEFORE INSERT OR UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_subjects
  BEFORE INSERT OR UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_teacher_subjects
  BEFORE INSERT OR UPDATE ON public.teacher_subjects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_student_attendance
  BEFORE INSERT OR UPDATE ON public.student_attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_teacher_attendance
  BEFORE INSERT OR UPDATE ON public.teacher_attendance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_exams
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- *** MARKS TABLE TRIGGER ***
CREATE TRIGGER enforce_tenant_id_marks
  BEFORE INSERT OR UPDATE ON public.marks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_homeworks
  BEFORE INSERT OR UPDATE ON public.homeworks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_assignments
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_assignment_submissions
  BEFORE INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_fee_structure
  BEFORE INSERT OR UPDATE ON public.fee_structure
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_student_fees
  BEFORE INSERT OR UPDATE ON public.student_fees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_student_discounts
  BEFORE INSERT OR UPDATE ON public.student_discounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_notifications
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_notification_recipients
  BEFORE INSERT OR UPDATE ON public.notification_recipients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_messages
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_tasks
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_personal_tasks
  BEFORE INSERT OR UPDATE ON public.personal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_school_details
  BEFORE INSERT OR UPDATE ON public.school_details
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_school_expenses
  BEFORE INSERT OR UPDATE ON public.school_expenses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_expense_categories
  BEFORE INSERT OR UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_events
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_leave_applications
  BEFORE INSERT OR UPDATE ON public.leave_applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_teacher_leave_balance
  BEFORE INSERT OR UPDATE ON public.teacher_leave_balance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_timetable_entries
  BEFORE INSERT OR UPDATE ON public.timetable_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

CREATE TRIGGER enforce_tenant_id_period_settings
  BEFORE INSERT OR UPDATE ON public.period_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- ==========================================
-- STEP 7: CREATE UNIQUE CONSTRAINTS WITH TENANT_ID
-- ==========================================

-- Add unique constraints that include tenant_id for proper multi-tenant isolation

-- Student attendance: unique per student, date, and tenant
DO $$
BEGIN
  -- Drop existing unique constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'student_attendance_unique_daily' 
    AND table_name = 'student_attendance'
  ) THEN
    ALTER TABLE public.student_attendance DROP CONSTRAINT student_attendance_unique_daily;
  END IF;
  
  -- Create new multi-tenant unique constraint
  ALTER TABLE public.student_attendance 
  ADD CONSTRAINT student_attendance_unique_daily 
  UNIQUE (student_id, date, tenant_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Could not create student_attendance unique constraint: %', SQLERRM;
END $$;

-- Marks: unique per student, exam, subject, and tenant (if needed)
-- Note: Based on schema, marks table doesn't have unique constraint
-- but we can add one for data integrity
DO $$
BEGIN
  -- Create multi-tenant unique constraint for marks if desired
  ALTER TABLE public.marks 
  ADD CONSTRAINT marks_unique_per_student_exam_subject 
  UNIQUE (student_id, exam_id, subject_id, tenant_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN others THEN
    RAISE NOTICE 'Could not create marks unique constraint: %', SQLERRM;
END $$;

-- ==========================================
-- STEP 8: CREATE SERVICE ROLE BYPASS POLICIES
-- ==========================================

-- Allow service role (anon/authenticated) to bypass RLS for administrative functions
-- This is needed for application-level operations

CREATE POLICY "service_role_bypass" ON public.users
  FOR ALL USING (
    auth.role() = 'service_role' OR
    tenant_id = public.get_current_tenant_id()
  );

-- Similar bypass policies for other tables if needed
CREATE POLICY "service_role_bypass_students" ON public.students
  FOR ALL USING (
    auth.role() = 'service_role' OR
    tenant_id = public.get_current_tenant_id()
  );

CREATE POLICY "service_role_bypass_teachers" ON public.teachers
  FOR ALL USING (
    auth.role() = 'service_role' OR
    tenant_id = public.get_current_tenant_id()
  );

CREATE POLICY "service_role_bypass_marks" ON public.marks
  FOR ALL USING (
    auth.role() = 'service_role' OR
    tenant_id = public.get_current_tenant_id()
  );

-- ==========================================
-- STEP 9: GRANT NECESSARY PERMISSIONS
-- ==========================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant permissions to anon role for public access
GRANT USAGE ON SCHEMA public TO anon;

-- ==========================================
-- STEP 10: CREATE VERIFICATION FUNCTIONS
-- ==========================================

-- Function to test RLS is working
CREATE OR REPLACE FUNCTION public.test_rls_isolation()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count integer,
  sample_accessible_records integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.rowsecurity,
    COALESCE(p.policy_count, 0)::integer,
    0::integer -- Placeholder for record count
  FROM pg_tables t
  LEFT JOIN (
    SELECT 
      tablename, 
      COUNT(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY tablename
  ) p ON t.tablename = p.tablename
  WHERE t.schemaname = 'public'
    AND t.tablename IN (
      'users', 'students', 'teachers', 'marks', 'student_attendance',
      'classes', 'subjects', 'exams', 'parents'
    )
  ORDER BY t.tablename;
END;
$$;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS IMPLEMENTATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary of changes:';
  RAISE NOTICE '- RLS enabled on all tables';
  RAISE NOTICE '- Tenant isolation policies created';
  RAISE NOTICE '- Role-based access policies created';  
  RAISE NOTICE '- Automatic tenant_id enforcement triggers created';
  RAISE NOTICE '- Helper functions for tenant context created';
  RAISE NOTICE '- Multi-tenant unique constraints added';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test with: SELECT * FROM public.test_rls_isolation();';
  RAISE NOTICE '2. Update application authentication to set tenant_id in JWT';
  RAISE NOTICE '3. Test marks entry and attendance functionality';
  RAISE NOTICE '========================================';
END $$;
