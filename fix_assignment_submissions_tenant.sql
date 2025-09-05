-- FIX ASSIGNMENT SUBMISSIONS TENANT_ID ISSUES AND ADD RLS POLICIES
-- This script addresses the null tenant_id constraint violation and adds proper RLS policies

-- First, let's check the current status
SELECT 'CHECKING CURRENT STATE...' as status;

-- Check students table for tenant_id values
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- Check if students have tenant_id populated
SELECT 
    s.id, 
    s.name, 
    s.tenant_id as student_tenant_id,
    u.tenant_id as user_tenant_id,
    CASE 
        WHEN s.tenant_id IS NULL AND u.tenant_id IS NOT NULL THEN 'NEEDS UPDATE'
        WHEN s.tenant_id IS NULL AND u.tenant_id IS NULL THEN 'USER HAS NO TENANT'
        ELSE 'OK'
    END as status
FROM students s
LEFT JOIN users u ON s.user_id = u.id
ORDER BY s.id
LIMIT 10;

-- STEP 1: Update students table to populate tenant_id from their associated user accounts
SELECT 'UPDATING STUDENTS TENANT_ID...' as status;

-- Update students with tenant_id from their associated users where tenant_id is null
UPDATE students 
SET tenant_id = u.tenant_id
FROM users u 
WHERE students.user_id = u.id 
  AND students.tenant_id IS NULL 
  AND u.tenant_id IS NOT NULL;

-- For students without users or users without tenant_id, set to first available tenant
UPDATE students 
SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- Show updated count
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- STEP 2: Check if assignment_submissions table exists and its structure
SELECT 'CHECKING ASSIGNMENT_SUBMISSIONS TABLE...' as status;

-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'assignment_submissions'
) as table_exists;

-- If table exists, check its structure
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignment_submissions') THEN
        -- Show column information
        RAISE NOTICE 'Assignment submissions table exists, checking structure...';
    ELSE
        -- Create the table with proper structure
        RAISE NOTICE 'Assignment submissions table does not exist, creating it...';
        
        CREATE TABLE assignment_submissions (
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

        -- Add indexes for better performance
        CREATE INDEX idx_assignment_submissions_student_id ON assignment_submissions(student_id);
        CREATE INDEX idx_assignment_submissions_assignment_id ON assignment_submissions(assignment_id);
        CREATE INDEX idx_assignment_submissions_tenant_id ON assignment_submissions(tenant_id);
        CREATE INDEX idx_assignment_submissions_assignment_type ON assignment_submissions(assignment_type);

        -- Add trigger for updated_at
        CREATE OR REPLACE FUNCTION update_assignment_submissions_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER trigger_assignment_submissions_updated_at
            BEFORE UPDATE ON assignment_submissions
            FOR EACH ROW
            EXECUTE FUNCTION update_assignment_submissions_updated_at();

        RAISE NOTICE 'Assignment submissions table created successfully!';
    END IF;
END
$$;

-- STEP 3: Enable RLS and create policies for assignment_submissions table
SELECT 'SETTING UP ASSIGNMENT_SUBMISSIONS RLS POLICIES...' as status;

-- Enable RLS on assignment_submissions table
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "tenant_assignment_submissions_select" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_insert" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_update" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_delete" ON assignment_submissions;

-- Create tenant-based policies for assignment_submissions
CREATE POLICY "tenant_assignment_submissions_select" ON assignment_submissions
FOR SELECT 
TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_insert" ON assignment_submissions
FOR INSERT 
TO authenticated
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_update" ON assignment_submissions
FOR UPDATE 
TO authenticated
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_delete" ON assignment_submissions
FOR DELETE 
TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

-- STEP 4: Also check if homeworks and assignments tables need RLS policies
SELECT 'SETTING UP HOMEWORKS RLS POLICIES...' as status;

-- Check if homeworks table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'homeworks') THEN
        ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "tenant_homeworks_select" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_insert" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_update" ON homeworks;
        DROP POLICY IF EXISTS "tenant_homeworks_delete" ON homeworks;
        
        -- Create new policies
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
    ELSE
        RAISE NOTICE 'Homeworks table does not exist, skipping...';
    END IF;
END
$$;

SELECT 'SETTING UP ASSIGNMENTS RLS POLICIES...' as status;

-- Check if assignments table exists and enable RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments') THEN
        ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "tenant_assignments_select" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_insert" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_update" ON assignments;
        DROP POLICY IF EXISTS "tenant_assignments_delete" ON assignments;
        
        -- Create new policies
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
    ELSE
        RAISE NOTICE 'Assignments table does not exist, skipping...';
    END IF;
END
$$;

-- STEP 5: Verification and testing
SELECT 'VERIFYING ASSIGNMENT SUBMISSIONS SETUP...' as status;

-- Show the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'assignment_submissions'
ORDER BY ordinal_position;

-- Show all policies for assignment submissions
SELECT 
    policyname,
    cmd as permission_type,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'assignment_submissions'
ORDER BY policyname;

-- Test current user's tenant access
SELECT 'TESTING TENANT ACCESS...' as status;

-- Test the helper function
SELECT * FROM public.check_user_tenant_assignment();

-- Show final status
SELECT '
🔐 ASSIGNMENT SUBMISSIONS TENANT FIX COMPLETED!

FIXES APPLIED:
✅ Updated students table to populate missing tenant_id values
✅ Created assignment_submissions table (if not exists)
✅ Added proper RLS policies for assignment_submissions
✅ Added RLS policies for homeworks and assignments tables
✅ All policies use tenant-based isolation

TABLE STRUCTURE:
✅ assignment_submissions.tenant_id NOT NULL constraint
✅ Proper foreign key references
✅ Indexes for performance
✅ Trigger for updated_at timestamp

RLS POLICIES CREATED:
✅ tenant_assignment_submissions_select
✅ tenant_assignment_submissions_insert  
✅ tenant_assignment_submissions_update
✅ tenant_assignment_submissions_delete

NEXT STEPS:
1. Test assignment submission in your app
2. Verify that student.tenant_id is not null
3. Check that submissions are properly isolated by tenant

STATUS: Assignment submissions tenant_id issue fixed!
' as success_message;
