-- FIX ASSIGNMENT SUBMISSIONS TENANT_ID ISSUES - SIMPLE VERSION
-- This script addresses the null tenant_id constraint violation

-- STEP 1: Check current students tenant_id status
SELECT 'CHECKING STUDENTS TENANT_ID STATUS...' as status;

SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- STEP 2: Update students with missing tenant_id from their user accounts
SELECT 'UPDATING STUDENTS TENANT_ID FROM USERS...' as status;

UPDATE students 
SET tenant_id = u.tenant_id
FROM users u 
WHERE students.user_id = u.id 
  AND students.tenant_id IS NULL 
  AND u.tenant_id IS NOT NULL;

-- STEP 3: For any remaining students without tenant_id, set to first tenant
UPDATE students 
SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- STEP 4: Show updated status
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- STEP 5: Create assignment_submissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('assignment', 'homework')),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    submitted_files JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded')),
    submitted_at TIMESTAMPTZ DEFAULT now(),
    graded_at TIMESTAMPTZ,
    grade TEXT,
    feedback TEXT,
    academic_year TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- STEP 6: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON assignment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_tenant_id ON assignment_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_type ON assignment_submissions(assignment_type);

-- STEP 7: Enable RLS and create policies for assignment_submissions
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "tenant_assignment_submissions_select" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_insert" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_update" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_delete" ON assignment_submissions;

-- Create tenant-based policies
CREATE POLICY "tenant_assignment_submissions_select" ON assignment_submissions
FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_insert" ON assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_update" ON assignment_submissions
FOR UPDATE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_delete" ON assignment_submissions
FOR DELETE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

-- STEP 8: Setup RLS for homeworks table if it exists
DO $homeworks_setup$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'homeworks') THEN
        ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tenant_homeworks_select" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_insert" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_update" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_delete" ON homeworks;
        
        CREATE POLICY "tenant_homeworks_select" ON homeworks
        FOR SELECT TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_homeworks_insert" ON homeworks
        FOR INSERT TO authenticated
        WITH CHECK (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_homeworks_update" ON homeworks
        FOR UPDATE TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id())
        WITH CHECK (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_homeworks_delete" ON homeworks
        FOR DELETE TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id());
        
        RAISE NOTICE 'Homeworks RLS policies created successfully!';
    END IF;
END
$homeworks_setup$;

-- STEP 9: Setup RLS for assignments table if it exists
DO $assignments_setup$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments') THEN
        ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tenant_assignments_select" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_insert" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_update" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_delete" ON assignments;
        
        CREATE POLICY "tenant_assignments_select" ON assignments
        FOR SELECT TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_assignments_insert" ON assignments
        FOR INSERT TO authenticated
        WITH CHECK (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_assignments_update" ON assignments
        FOR UPDATE TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id())
        WITH CHECK (tenant_id = public.get_current_user_tenant_id());
        
        CREATE POLICY "tenant_assignments_delete" ON assignments
        FOR DELETE TO authenticated
        USING (tenant_id = public.get_current_user_tenant_id());
        
        RAISE NOTICE 'Assignments RLS policies created successfully!';
    END IF;
END
$assignments_setup$;

-- STEP 10: Verification
SELECT 'VERIFICATION - ASSIGNMENT SUBMISSIONS SETUP COMPLETE!' as status;

-- Show policies created
SELECT 
    tablename,
    policyname,
    cmd as permission_type
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('assignment_submissions', 'homeworks', 'assignments')
ORDER BY tablename, policyname;
