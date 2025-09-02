-- Row Level Security (RLS) Policies for Multi-Tenant School Management System
-- This script creates RLS policies to ensure data isolation between tenants

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================

-- Enable RLS on the tenants table itself
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Enable RLS on all other tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_leave_balance ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TENANT ISOLATION POLICIES
-- ==========================================

-- Tenants table policies (only super admin or tenant owner can view)
CREATE POLICY "tenants_isolation" ON public.tenants
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'super_admin' OR 
    id::text = auth.jwt() ->> 'tenant_id'
  );

-- Generic tenant isolation policy template for all other tables
-- Users can only access data from their own tenant

-- Users table policies
CREATE POLICY "users_tenant_isolation" ON public.users
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Roles table policies
CREATE POLICY "roles_tenant_isolation" ON public.roles
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Classes table policies
CREATE POLICY "classes_tenant_isolation" ON public.classes
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Students table policies
CREATE POLICY "students_tenant_isolation" ON public.students
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Parents table policies
CREATE POLICY "parents_tenant_isolation" ON public.parents
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Teachers table policies
CREATE POLICY "teachers_tenant_isolation" ON public.teachers
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Subjects table policies
CREATE POLICY "subjects_tenant_isolation" ON public.subjects
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Teacher subjects table policies
CREATE POLICY "teacher_subjects_tenant_isolation" ON public.teacher_subjects
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Student attendance table policies
CREATE POLICY "student_attendance_tenant_isolation" ON public.student_attendance
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Teacher attendance table policies
CREATE POLICY "teacher_attendance_tenant_isolation" ON public.teacher_attendance
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Fee structure table policies
CREATE POLICY "fee_structure_tenant_isolation" ON public.fee_structure
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Student fees table policies
CREATE POLICY "student_fees_tenant_isolation" ON public.student_fees
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Student discounts table policies
CREATE POLICY "student_discounts_tenant_isolation" ON public.student_discounts
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Exams table policies
CREATE POLICY "exams_tenant_isolation" ON public.exams
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Marks table policies
CREATE POLICY "marks_tenant_isolation" ON public.marks
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Homeworks table policies
CREATE POLICY "homeworks_tenant_isolation" ON public.homeworks
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Assignments table policies
CREATE POLICY "assignments_tenant_isolation" ON public.assignments
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Assignment submissions table policies
CREATE POLICY "assignment_submissions_tenant_isolation" ON public.assignment_submissions
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Timetable entries table policies
CREATE POLICY "timetable_entries_tenant_isolation" ON public.timetable_entries
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Period settings table policies
CREATE POLICY "period_settings_tenant_isolation" ON public.period_settings
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Notifications table policies
CREATE POLICY "notifications_tenant_isolation" ON public.notifications
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Notification recipients table policies
CREATE POLICY "notification_recipients_tenant_isolation" ON public.notification_recipients
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Messages table policies
CREATE POLICY "messages_tenant_isolation" ON public.messages
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Tasks table policies
CREATE POLICY "tasks_tenant_isolation" ON public.tasks
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Personal tasks table policies
CREATE POLICY "personal_tasks_tenant_isolation" ON public.personal_tasks
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- School details table policies
CREATE POLICY "school_details_tenant_isolation" ON public.school_details
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- School expenses table policies
CREATE POLICY "school_expenses_tenant_isolation" ON public.school_expenses
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Expense categories table policies
CREATE POLICY "expense_categories_tenant_isolation" ON public.expense_categories
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Events table policies
CREATE POLICY "events_tenant_isolation" ON public.events
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Leave applications table policies
CREATE POLICY "leave_applications_tenant_isolation" ON public.leave_applications
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Teacher leave balance table policies
CREATE POLICY "teacher_leave_balance_tenant_isolation" ON public.teacher_leave_balance
  FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ==========================================
-- ROLE-BASED ACCESS CONTROL POLICIES
-- ==========================================

-- Example of more granular policies based on roles
-- These can be added on top of tenant isolation policies

-- Admin access to users (within same tenant)
CREATE POLICY "admin_users_access" ON public.users
  FOR ALL USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'super_admin')
  );

-- Teachers can view students in their classes
CREATE POLICY "teachers_view_students" ON public.students
  FOR SELECT USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' = 'teacher' AND
    EXISTS (
      SELECT 1 FROM public.teacher_subjects ts
      JOIN public.subjects s ON ts.subject_id = s.id
      WHERE ts.teacher_id = (auth.jwt() ->> 'linked_teacher_id')::uuid
        AND s.class_id = students.class_id
        AND s.tenant_id::text = auth.jwt() ->> 'tenant_id'
    )
  );

-- Students can only view their own data
CREATE POLICY "students_own_data" ON public.students
  FOR SELECT USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' = 'student' AND
    id = (auth.jwt() ->> 'linked_student_id')::uuid
  );

-- Parents can view their children's data
CREATE POLICY "parents_children_data" ON public.students
  FOR SELECT USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' = 'parent' AND
    id = (auth.jwt() ->> 'linked_parent_of')::uuid
  );

-- ==========================================
-- INSERT/UPDATE POLICIES WITH TENANT ENFORCEMENT
-- ==========================================

-- Ensure new records are created with correct tenant_id
-- This prevents users from accidentally creating records in wrong tenants

-- Template function to enforce tenant_id on INSERT
CREATE OR REPLACE FUNCTION public.enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set tenant_id from JWT if not already set
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  END IF;
  
  -- Ensure tenant_id matches JWT
  IF NEW.tenant_id::text != auth.jwt() ->> 'tenant_id' THEN
    RAISE EXCEPTION 'Cannot create record for different tenant';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for all tables that need tenant enforcement
-- Note: Only adding a few examples here - add for all tables as needed

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

-- ==========================================
-- UTILITY FUNCTIONS FOR RLS
-- ==========================================

-- Function to get current user's tenant_id from JWT
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'tenant_id')::uuid,
    (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
  );
$$;

-- Function to check if current user is admin in their tenant
CREATE OR REPLACE FUNCTION public.is_admin_in_tenant()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND u.tenant_id::text = auth.jwt() ->> 'tenant_id'
      AND r.role_name IN ('admin', 'super_admin')
  );
$$;

-- Function to validate tenant access
CREATE OR REPLACE FUNCTION public.validate_tenant_access(target_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    auth.jwt() ->> 'role' = 'super_admin' OR
    target_tenant_id::text = auth.jwt() ->> 'tenant_id';
$$;

COMMENT ON FUNCTION public.enforce_tenant_id() IS 'Trigger function to enforce tenant_id on INSERT/UPDATE';
COMMENT ON FUNCTION public.get_current_tenant_id() IS 'Returns current user tenant ID from JWT or users table';
COMMENT ON FUNCTION public.is_admin_in_tenant() IS 'Checks if current user is admin in their tenant';
COMMENT ON FUNCTION public.validate_tenant_access(uuid) IS 'Validates if user can access target tenant';
