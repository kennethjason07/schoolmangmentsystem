-- Multi-Tenancy Migration Script for School Management System
-- This script adds multi-tenancy support to all existing tables

-- ==========================================
-- STEP 1: CREATE TENANTS TABLE
-- ==========================================

CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  domain text UNIQUE,
  database_url text, -- For database-per-tenant approach (optional)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  subscription_plan text DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'standard', 'premium', 'enterprise')),
  max_students integer DEFAULT 500,
  max_teachers integer DEFAULT 50,
  max_classes integer DEFAULT 20,
  features jsonb DEFAULT '{"messaging": true, "attendance": true, "fees": true, "exams": true}',
  settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp with time zone,
  contact_email text,
  contact_phone text,
  address text,
  logo_url text,
  timezone text DEFAULT 'UTC',
  academic_year_start_month integer DEFAULT 4, -- April
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);

-- Create index on subdomain for fast lookup
CREATE INDEX idx_tenants_subdomain ON public.tenants(subdomain);
CREATE INDEX idx_tenants_status ON public.tenants(status);

-- ==========================================
-- STEP 2: ADD TENANT_ID TO ALL TABLES
-- ==========================================

-- Add tenant_id column to all existing tables
ALTER TABLE public.users ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.roles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.classes ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.students ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.parents ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.teachers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.subjects ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.teacher_subjects ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.student_attendance ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.teacher_attendance ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.fee_structure ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.student_fees ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.student_discounts ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.exams ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.marks ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.homeworks ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.assignments ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.assignment_submissions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.timetable_entries ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.period_settings ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.notifications ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.notification_recipients ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.messages ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.tasks ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.personal_tasks ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.school_details ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.school_expenses ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.expense_categories ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.events ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.leave_applications ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.teacher_leave_balance ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- ==========================================
-- STEP 3: CREATE DEFAULT TENANT FOR EXISTING DATA
-- ==========================================

-- Insert default tenant for existing data
INSERT INTO public.tenants (
  id,
  name,
  subdomain,
  status,
  subscription_plan,
  max_students,
  max_teachers,
  max_classes,
  contact_email,
  created_at
) VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000',
  'Default School',
  'default',
  'active',
  'enterprise',
  1000,
  100,
  50,
  'admin@school.com',
  CURRENT_TIMESTAMP
);

-- Update all existing records with default tenant_id
UPDATE public.users SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.roles SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.classes SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.students SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.parents SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.teachers SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.subjects SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.teacher_subjects SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.student_attendance SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.teacher_attendance SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.fee_structure SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.student_fees SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.student_discounts SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.exams SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.marks SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.homeworks SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.assignments SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.assignment_submissions SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.timetable_entries SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.period_settings SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.notifications SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.notification_recipients SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.messages SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.tasks SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.personal_tasks SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.school_details SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.school_expenses SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.expense_categories SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.events SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.leave_applications SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;
UPDATE public.teacher_leave_balance SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' WHERE tenant_id IS NULL;

-- ==========================================
-- STEP 4: MAKE TENANT_ID NOT NULL AND ADD CONSTRAINTS
-- ==========================================

-- After updating existing data, make tenant_id NOT NULL
ALTER TABLE public.users ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.roles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.classes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.parents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.teachers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.subjects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.teacher_subjects ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.student_attendance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.teacher_attendance ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.fee_structure ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.student_fees ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.student_discounts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.exams ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.marks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.homeworks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.assignment_submissions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.timetable_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.period_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.notification_recipients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.personal_tasks ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.school_details ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.school_expenses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.expense_categories ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.leave_applications ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.teacher_leave_balance ALTER COLUMN tenant_id SET NOT NULL;

-- ==========================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ==========================================

-- Create indexes on tenant_id for all tables (crucial for multi-tenant performance)
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX idx_classes_tenant_id ON public.classes(tenant_id);
CREATE INDEX idx_students_tenant_id ON public.students(tenant_id);
CREATE INDEX idx_parents_tenant_id ON public.parents(tenant_id);
CREATE INDEX idx_teachers_tenant_id ON public.teachers(tenant_id);
CREATE INDEX idx_subjects_tenant_id ON public.subjects(tenant_id);
CREATE INDEX idx_teacher_subjects_tenant_id ON public.teacher_subjects(tenant_id);
CREATE INDEX idx_student_attendance_tenant_id ON public.student_attendance(tenant_id);
CREATE INDEX idx_teacher_attendance_tenant_id ON public.teacher_attendance(tenant_id);
CREATE INDEX idx_fee_structure_tenant_id ON public.fee_structure(tenant_id);
CREATE INDEX idx_student_fees_tenant_id ON public.student_fees(tenant_id);
CREATE INDEX idx_student_discounts_tenant_id ON public.student_discounts(tenant_id);
CREATE INDEX idx_exams_tenant_id ON public.exams(tenant_id);
CREATE INDEX idx_marks_tenant_id ON public.marks(tenant_id);
CREATE INDEX idx_homeworks_tenant_id ON public.homeworks(tenant_id);
CREATE INDEX idx_assignments_tenant_id ON public.assignments(tenant_id);
CREATE INDEX idx_assignment_submissions_tenant_id ON public.assignment_submissions(tenant_id);
CREATE INDEX idx_timetable_entries_tenant_id ON public.timetable_entries(tenant_id);
CREATE INDEX idx_period_settings_tenant_id ON public.period_settings(tenant_id);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX idx_notification_recipients_tenant_id ON public.notification_recipients(tenant_id);
CREATE INDEX idx_messages_tenant_id ON public.messages(tenant_id);
CREATE INDEX idx_tasks_tenant_id ON public.tasks(tenant_id);
CREATE INDEX idx_personal_tasks_tenant_id ON public.personal_tasks(tenant_id);
CREATE INDEX idx_school_details_tenant_id ON public.school_details(tenant_id);
CREATE INDEX idx_school_expenses_tenant_id ON public.school_expenses(tenant_id);
CREATE INDEX idx_expense_categories_tenant_id ON public.expense_categories(tenant_id);
CREATE INDEX idx_events_tenant_id ON public.events(tenant_id);
CREATE INDEX idx_leave_applications_tenant_id ON public.leave_applications(tenant_id);
CREATE INDEX idx_teacher_leave_balance_tenant_id ON public.teacher_leave_balance(tenant_id);

-- Create composite indexes for frequently queried combinations
CREATE INDEX idx_students_tenant_class ON public.students(tenant_id, class_id);
CREATE INDEX idx_student_attendance_tenant_date ON public.student_attendance(tenant_id, date);
CREATE INDEX idx_users_tenant_email ON public.users(tenant_id, email);

-- ==========================================
-- STEP 6: CREATE UTILITY FUNCTIONS
-- ==========================================

-- Function to get current tenant from JWT claims
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('app.current_tenant_id', true), ''),
    auth.jwt() ->> 'tenant_id'
  )::uuid;
$$;

-- Function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(user_id uuid, tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_id AND users.tenant_id = user_belongs_to_tenant.tenant_id
  );
$$;

-- Function to create a new tenant with default data
CREATE OR REPLACE FUNCTION public.create_tenant(
  tenant_name text,
  tenant_subdomain text,
  contact_email text DEFAULT NULL,
  contact_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  new_tenant_id uuid;
  admin_role_id integer;
  teacher_role_id integer;
  student_role_id integer;
  parent_role_id integer;
BEGIN
  -- Create the tenant
  INSERT INTO public.tenants (name, subdomain, contact_email, contact_phone)
  VALUES (tenant_name, tenant_subdomain, contact_email, contact_phone)
  RETURNING id INTO new_tenant_id;
  
  -- Create default roles for the tenant
  INSERT INTO public.roles (role_name, tenant_id) VALUES 
    ('admin', new_tenant_id),
    ('teacher', new_tenant_id),
    ('student', new_tenant_id),
    ('parent', new_tenant_id);
  
  -- Create default expense categories
  INSERT INTO public.expense_categories (name, tenant_id, monthly_budget) VALUES 
    ('Infrastructure', new_tenant_id, 50000),
    ('Salaries', new_tenant_id, 200000),
    ('Utilities', new_tenant_id, 15000),
    ('Supplies', new_tenant_id, 25000),
    ('Maintenance', new_tenant_id, 20000),
    ('Other', new_tenant_id, 10000);
  
  RETURN new_tenant_id;
END;
$$;

COMMENT ON TABLE public.tenants IS 'Multi-tenant support table storing school/organization information';
COMMENT ON FUNCTION public.current_tenant_id() IS 'Returns the current tenant ID from JWT or app context';
COMMENT ON FUNCTION public.create_tenant(text, text, text, text) IS 'Creates a new tenant with default configuration';
