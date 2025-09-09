-- Create missing homework and assignment tables based on schema.txt
-- This script creates the tables that were missing from the main schema creation

-- Create ASSIGNMENTS table
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  file_url text,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  academic_year text NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.teachers(id)
);

-- Create HOMEWORKS table
CREATE TABLE IF NOT EXISTS public.homeworks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  instructions text,
  due_date date,
  class_id uuid,
  subject_id uuid,
  teacher_id uuid,
  assigned_students uuid[] DEFAULT '{}',
  files jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT homeworks_pkey PRIMARY KEY (id),
  CONSTRAINT homeworks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT homeworks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT homeworks_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT homeworks_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
);

-- Create ASSIGNMENT_SUBMISSIONS table with tenant_id support
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  assignment_type text NOT NULL CHECK (assignment_type = ANY (ARRAY['assignment'::text, 'homework'::text])),
  student_id uuid NOT NULL,
  submitted_files jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'graded'::text, 'returned'::text])),
  grade text,
  feedback text,
  submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  graded_at timestamp with time zone,
  academic_year text DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  tenant_id uuid NOT NULL,
  CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignments_tenant_id ON assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

CREATE INDEX IF NOT EXISTS idx_homeworks_tenant_id ON homeworks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_subject_id ON homeworks(subject_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_due_date ON homeworks(due_date);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_id ON homeworks(teacher_id);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_tenant_id ON assignment_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_type ON assignment_submissions(assignment_type);

-- Enable Row Level Security on all tables
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for ASSIGNMENTS
CREATE POLICY "Tenant isolation for assignments" ON assignments
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS Policies for HOMEWORKS
CREATE POLICY "Tenant isolation for homeworks" ON homeworks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create RLS Policies for ASSIGNMENT_SUBMISSIONS
CREATE POLICY "Tenant isolation for assignment_submissions" ON assignment_submissions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Create updated_at trigger for homeworks
CREATE OR REPLACE FUNCTION update_homeworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_homeworks_updated_at 
    BEFORE UPDATE ON homeworks 
    FOR EACH ROW EXECUTE FUNCTION update_homeworks_updated_at();

-- Create updated_at trigger for assignment_submissions
CREATE OR REPLACE FUNCTION update_assignment_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_assignment_submissions_updated_at 
    BEFORE UPDATE ON assignment_submissions 
    FOR EACH ROW EXECUTE FUNCTION update_assignment_submissions_updated_at();

-- Verification
SELECT 
    table_name,
    '✅ CREATED' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN ('assignments', 'homeworks', 'assignment_submissions')
ORDER BY table_name;

SELECT '
🎉 HOMEWORK AND ASSIGNMENT TABLES CREATED!

TABLES CREATED:
✅ assignments - Assignment management
✅ homeworks - Homework management  
✅ assignment_submissions - Student submissions

FEATURES ENABLED:
✅ Multi-tenancy support
✅ Row Level Security (RLS)
✅ Proper foreign key relationships
✅ Performance indexes
✅ Updated timestamp triggers

NEXT STEPS:
1. Create sample homework data for testing
2. Verify parent dashboard can now display homework
3. Test homework submission functionality

STATUS: Homework tables now exist - parent dashboard should work!
' as success_message;
