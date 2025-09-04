-- CREATE MISSING DATABASE TABLES
-- This script creates all the tables that are missing from your database
-- Based on your schema.txt file

-- First, let's check what tables already exist
SELECT 
    'Checking existing tables...' as status,
    COUNT(*) as existing_table_count
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- List existing tables
SELECT 
    table_name,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Create sequences first
CREATE SEQUENCE IF NOT EXISTS expense_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS roles_id_seq;
CREATE SEQUENCE IF NOT EXISTS school_expenses_id_seq;
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq;

-- Create TENANTS table first (foundational)
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE,
  domain text UNIQUE,
  database_url text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'suspended'::text, 'inactive'::text])),
  subscription_plan text DEFAULT 'basic'::text CHECK (subscription_plan = ANY (ARRAY['basic'::text, 'standard'::text, 'premium'::text, 'enterprise'::text])),
  max_students integer DEFAULT 500,
  max_teachers integer DEFAULT 50,
  max_classes integer DEFAULT 20,
  features jsonb DEFAULT '{"fees": true, "exams": true, "messaging": true, "attendance": true}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  expires_at timestamp with time zone,
  contact_email text,
  contact_phone text,
  address text,
  logo_url text,
  timezone text DEFAULT 'UTC'::text,
  academic_year_start_month integer DEFAULT 4,
  CONSTRAINT tenants_pkey PRIMARY KEY (id)
);

-- Create ROLES table
CREATE TABLE IF NOT EXISTS public.roles (
  id integer NOT NULL DEFAULT nextval('roles_id_seq'::regclass),
  role_name text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create CLASSES table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  section text NOT NULL,
  academic_year text NOT NULL,
  class_teacher_id uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create TEACHERS table
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  qualification text,
  age integer CHECK (age > 18),
  salary_type text NOT NULL CHECK (salary_type = ANY (ARRAY['monthly'::text, 'hourly'::text])),
  salary_amount numeric NOT NULL,
  address text,
  is_class_teacher boolean DEFAULT false,
  assigned_class_id uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  phone text,
  tenant_id uuid NOT NULL,
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Add foreign key for classes.class_teacher_id after teachers table exists
ALTER TABLE public.classes ADD CONSTRAINT classes_class_teacher_id_fkey 
FOREIGN KEY (class_teacher_id) REFERENCES public.teachers(id);

-- Create PARENTS table
CREATE TABLE IF NOT EXISTS public.parents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  student_id uuid,
  relation text CHECK (relation = ANY (ARRAY['Father'::text, 'Mother'::text, 'Guardian'::text])),
  tenant_id uuid NOT NULL,
  CONSTRAINT parents_pkey PRIMARY KEY (id),
  CONSTRAINT parents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create STUDENTS table (the main one you need!)
CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admission_no text NOT NULL UNIQUE,
  name text NOT NULL,
  dob date NOT NULL,
  aadhar_no text,
  place_of_birth text,
  nationality text,
  gender text NOT NULL CHECK (gender = ANY (ARRAY['Male'::text, 'Female'::text])),
  religion text,
  caste text CHECK (caste = ANY (ARRAY['BC'::text, 'SC'::text, 'ST'::text, 'OC'::text, 'Other'::text])),
  address text,
  pin_code text,
  blood_group text,
  mother_tongue text,
  identification_mark_1 text,
  identification_mark_2 text,
  academic_year text NOT NULL,
  general_behaviour text CHECK (general_behaviour = ANY (ARRAY['Mild'::text, 'Normal'::text, 'Hyperactive'::text])),
  remarks text,
  roll_no integer,
  class_id uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  parent_id uuid,
  tenant_id uuid NOT NULL,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id),
  CONSTRAINT students_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Add foreign key for parents.student_id after students table exists
ALTER TABLE public.parents ADD CONSTRAINT parents_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES public.students(id);

-- Create USERS table
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role_id integer,
  linked_student_id uuid,
  linked_teacher_id uuid,
  linked_parent_of uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  password text,
  full_name text NOT NULL DEFAULT ''::text,
  phone text,
  profile_url text,
  tenant_id uuid NOT NULL,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT users_linked_parent_of_fkey FOREIGN KEY (linked_parent_of) REFERENCES public.students(id),
  CONSTRAINT users_linked_teacher_id_fkey FOREIGN KEY (linked_teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT users_linked_student_id_fkey FOREIGN KEY (linked_student_id) REFERENCES public.students(id)
);

-- Create SUBJECTS table
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid NOT NULL,
  academic_year text NOT NULL,
  is_optional boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

-- Create STUDENT_ATTENDANCE table
CREATE TABLE IF NOT EXISTS public.student_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['Present'::text, 'Absent'::text])),
  marked_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT student_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT student_attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT student_attendance_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id),
  CONSTRAINT student_attendance_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT student_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- Create EXAMS table
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_id uuid NOT NULL,
  academic_year text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  remarks text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  max_marks numeric NOT NULL DEFAULT 100,
  tenant_id uuid NOT NULL,
  CONSTRAINT exams_pkey PRIMARY KEY (id),
  CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT exams_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Create MARKS table
CREATE TABLE IF NOT EXISTS public.marks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  exam_id uuid,
  subject_id uuid,
  marks_obtained numeric,
  grade text,
  max_marks numeric NOT NULL,
  remarks text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT marks_pkey PRIMARY KEY (id),
  CONSTRAINT marks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT marks_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(id),
  CONSTRAINT marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT marks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

-- Create STUDENT_FEES table
CREATE TABLE IF NOT EXISTS public.student_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  academic_year text NOT NULL,
  fee_component text NOT NULL,
  amount_paid numeric NOT NULL,
  payment_date date NOT NULL,
  payment_mode text CHECK (payment_mode = ANY (ARRAY['Cash'::text, 'Card'::text, 'Online'::text, 'UPI'::text])),
  remarks text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  receipt_number bigint NOT NULL DEFAULT nextval('receipt_number_seq'::regclass) UNIQUE,
  tenant_id uuid NOT NULL,
  CONSTRAINT student_fees_pkey PRIMARY KEY (id),
  CONSTRAINT student_fees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT student_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- Create FEE_STRUCTURE table
CREATE TABLE IF NOT EXISTS public.fee_structure (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  academic_year text NOT NULL,
  class_id uuid,
  student_id uuid,
  fee_component text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  due_date date,
  base_amount numeric NOT NULL,
  discount_applied numeric DEFAULT 0,
  tenant_id uuid NOT NULL,
  CONSTRAINT fee_structure_pkey PRIMARY KEY (id),
  CONSTRAINT fee_structure_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT fee_structure_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT fee_structure_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

-- Insert default data to get you started
DO $$
DECLARE
    default_tenant_id UUID;
    admin_role_id INTEGER;
    teacher_role_id INTEGER;
    student_role_id INTEGER;
    parent_role_id INTEGER;
    sample_class_id UUID;
BEGIN
    -- Create default tenant
    INSERT INTO tenants (id, name, subdomain, status, contact_email)
    VALUES (gen_random_uuid(), 'School Management System', 'school', 'active', 'admin@school.com')
    RETURNING id INTO default_tenant_id;
    
    RAISE NOTICE '✅ Created default tenant: %', default_tenant_id;
    
    -- Create default roles
    INSERT INTO roles (role_name, tenant_id) VALUES ('admin', default_tenant_id) RETURNING id INTO admin_role_id;
    INSERT INTO roles (role_name, tenant_id) VALUES ('teacher', default_tenant_id) RETURNING id INTO teacher_role_id;
    INSERT INTO roles (role_name, tenant_id) VALUES ('student', default_tenant_id) RETURNING id INTO student_role_id;
    INSERT INTO roles (role_name, tenant_id) VALUES ('parent', default_tenant_id) RETURNING id INTO parent_role_id;
    
    RAISE NOTICE '✅ Created default roles';
    
    -- Create sample class
    INSERT INTO classes (id, class_name, section, academic_year, tenant_id)
    VALUES (gen_random_uuid(), '1st Grade', 'A', '2024-25', default_tenant_id)
    RETURNING id INTO sample_class_id;
    
    RAISE NOTICE '✅ Created sample class: %', sample_class_id;
    
    -- Create sample students
    INSERT INTO students (admission_no, name, dob, gender, academic_year, class_id, tenant_id)
    VALUES 
        ('STU001', 'John Doe', '2010-05-15', 'Male', '2024-25', sample_class_id, default_tenant_id),
        ('STU002', 'Jane Smith', '2010-08-22', 'Female', '2024-25', sample_class_id, default_tenant_id),
        ('STU003', 'Mike Johnson', '2010-03-10', 'Male', '2024-25', sample_class_id, default_tenant_id);
    
    RAISE NOTICE '✅ Created sample students';
    
    -- Store tenant ID for later use
    RAISE NOTICE '';
    RAISE NOTICE '🎯 IMPORTANT - SAVE THIS TENANT ID: %', default_tenant_id;
    RAISE NOTICE '   Use this tenant ID in your application configuration';
    RAISE NOTICE '';
END $$;

-- Final verification
SELECT 'Verifying created tables...' as status;

SELECT 
    table_name,
    '✅ CREATED' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('tenants', 'roles', 'classes', 'teachers', 'students', 'users', 'parents')
ORDER BY table_name;

-- Check sample data
SELECT 
    'students' as table_name,
    COUNT(*) as record_count,
    MIN(name) as sample_name
FROM students
UNION ALL
SELECT 
    'classes',
    COUNT(*),
    MIN(class_name)
FROM classes
UNION ALL
SELECT 
    'tenants',
    COUNT(*),
    MIN(name)
FROM tenants;

SELECT '
🎉 DATABASE TABLES CREATED SUCCESSFULLY!

WHAT WAS CREATED:
✅ tenants - with default school tenant
✅ roles - admin, teacher, student, parent
✅ classes - sample 1st Grade A class
✅ students - 3 sample students (John, Jane, Mike)
✅ teachers - table ready for teachers
✅ parents - table ready for parents
✅ users - table ready for user accounts
✅ All other supporting tables

NEXT STEPS:
1. Note the tenant ID shown above
2. Students should now be accessible in your app
3. You can add more students, classes, teachers as needed
4. Set up RLS policies for security (run RLS fix script)

STATUS: Your students table now exists with sample data!
' as success_message;
