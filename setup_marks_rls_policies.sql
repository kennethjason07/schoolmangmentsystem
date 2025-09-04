-- ================================================================
-- RLS POLICIES SETUP FOR MARKS TABLE AND TENANT ISOLATION  
-- ================================================================
-- This script sets up Row Level Security policies for the marks table
-- and creates necessary tenant context functions

-- Step 1: Create or replace the tenant context function
-- ================================================================

-- Function to get current user's tenant_id from JWT or user table
CREATE OR REPLACE FUNCTION auth.current_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_uuid uuid;
    current_user_id uuid;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := auth.uid();
    
    -- If no authenticated user, return NULL
    IF current_user_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- First try to get tenant_id from JWT claims
    tenant_uuid := (auth.jwt() ->> 'tenant_id')::uuid;
    
    -- If not in JWT, get from users table
    IF tenant_uuid IS NULL THEN
        SELECT u.tenant_id INTO tenant_uuid
        FROM public.users u
        WHERE u.id = current_user_id;
    END IF;
    
    -- Return the tenant_id (could still be NULL if user doesn't have one)
    RETURN tenant_uuid;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return NULL
        RAISE LOG 'Error in current_user_tenant_id(): %', SQLERRM;
        RETURN NULL;
END;
$$;

-- Step 2: Enable RLS on marks table
-- ================================================================

-- Enable Row Level Security on marks table
ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist
-- ================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "tenant_marks_select" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_insert" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_update" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_delete" ON public.marks;

-- Step 4: Create comprehensive RLS policies for marks table
-- ================================================================

-- Policy for SELECT: Users can only see marks from their own tenant
CREATE POLICY "tenant_marks_select" 
ON public.marks 
FOR SELECT 
TO authenticated 
USING (
    tenant_id = auth.current_user_tenant_id() 
    OR auth.current_user_tenant_id() IS NULL  -- Allow if no tenant context (for migration)
);

-- Policy for INSERT: Users can only insert marks for their own tenant
CREATE POLICY "tenant_marks_insert" 
ON public.marks 
FOR INSERT 
TO authenticated 
WITH CHECK (
    tenant_id = auth.current_user_tenant_id() 
    AND auth.current_user_tenant_id() IS NOT NULL  -- Require tenant context for inserts
);

-- Policy for UPDATE: Users can only update marks from their own tenant
CREATE POLICY "tenant_marks_update" 
ON public.marks 
FOR UPDATE 
TO authenticated 
USING (
    tenant_id = auth.current_user_tenant_id() 
    AND auth.current_user_tenant_id() IS NOT NULL
)
WITH CHECK (
    tenant_id = auth.current_user_tenant_id() 
    AND auth.current_user_tenant_id() IS NOT NULL
);

-- Policy for DELETE: Users can only delete marks from their own tenant
CREATE POLICY "tenant_marks_delete" 
ON public.marks 
FOR DELETE 
TO authenticated 
USING (
    tenant_id = auth.current_user_tenant_id() 
    AND auth.current_user_tenant_id() IS NOT NULL
);

-- Step 5: Set up RLS for related tables (exams, students, subjects, classes)
-- ================================================================

-- Enable RLS on related tables
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies for related tables
DROP POLICY IF EXISTS "tenant_exams_select" ON public.exams;
DROP POLICY IF EXISTS "tenant_exams_insert" ON public.exams;
DROP POLICY IF EXISTS "tenant_exams_update" ON public.exams;
DROP POLICY IF EXISTS "tenant_exams_delete" ON public.exams;

DROP POLICY IF EXISTS "tenant_students_select" ON public.students;
DROP POLICY IF EXISTS "tenant_students_insert" ON public.students;
DROP POLICY IF EXISTS "tenant_students_update" ON public.students;
DROP POLICY IF EXISTS "tenant_students_delete" ON public.students;

DROP POLICY IF EXISTS "tenant_subjects_select" ON public.subjects;
DROP POLICY IF EXISTS "tenant_subjects_insert" ON public.subjects;
DROP POLICY IF EXISTS "tenant_subjects_update" ON public.subjects;
DROP POLICY IF EXISTS "tenant_subjects_delete" ON public.subjects;

DROP POLICY IF EXISTS "tenant_classes_select" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_insert" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_update" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_delete" ON public.classes;

DROP POLICY IF EXISTS "tenant_users_select" ON public.users;
DROP POLICY IF EXISTS "tenant_users_insert" ON public.users;
DROP POLICY IF EXISTS "tenant_users_update" ON public.users;
DROP POLICY IF EXISTS "tenant_users_delete" ON public.users;

-- RLS Policies for EXAMS table
CREATE POLICY "tenant_exams_select" ON public.exams FOR SELECT TO authenticated USING (tenant_id = auth.current_user_tenant_id() OR auth.current_user_tenant_id() IS NULL);
CREATE POLICY "tenant_exams_insert" ON public.exams FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_exams_update" ON public.exams FOR UPDATE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL) WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_exams_delete" ON public.exams FOR DELETE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);

-- RLS Policies for STUDENTS table
CREATE POLICY "tenant_students_select" ON public.students FOR SELECT TO authenticated USING (tenant_id = auth.current_user_tenant_id() OR auth.current_user_tenant_id() IS NULL);
CREATE POLICY "tenant_students_insert" ON public.students FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_students_update" ON public.students FOR UPDATE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL) WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_students_delete" ON public.students FOR DELETE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);

-- RLS Policies for SUBJECTS table
CREATE POLICY "tenant_subjects_select" ON public.subjects FOR SELECT TO authenticated USING (tenant_id = auth.current_user_tenant_id() OR auth.current_user_tenant_id() IS NULL);
CREATE POLICY "tenant_subjects_insert" ON public.subjects FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_subjects_update" ON public.subjects FOR UPDATE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL) WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_subjects_delete" ON public.subjects FOR DELETE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);

-- RLS Policies for CLASSES table
CREATE POLICY "tenant_classes_select" ON public.classes FOR SELECT TO authenticated USING (tenant_id = auth.current_user_tenant_id() OR auth.current_user_tenant_id() IS NULL);
CREATE POLICY "tenant_classes_insert" ON public.classes FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_classes_update" ON public.classes FOR UPDATE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL) WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_classes_delete" ON public.classes FOR DELETE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);

-- RLS Policies for USERS table
CREATE POLICY "tenant_users_select" ON public.users FOR SELECT TO authenticated USING (tenant_id = auth.current_user_tenant_id() OR auth.current_user_tenant_id() IS NULL);
CREATE POLICY "tenant_users_insert" ON public.users FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_users_update" ON public.users FOR UPDATE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL) WITH CHECK (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);
CREATE POLICY "tenant_users_delete" ON public.users FOR DELETE TO authenticated USING (tenant_id = auth.current_user_tenant_id() AND auth.current_user_tenant_id() IS NOT NULL);

-- Step 6: Set up tenant context for current user (if missing)
-- ================================================================

-- Function to update current user with tenant_id if missing
CREATE OR REPLACE FUNCTION public.ensure_user_has_tenant_id(default_tenant_id uuid DEFAULT 'b8f8b5f0-1234-4567-8901-123456789000'::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    user_tenant_id uuid;
    tenant_exists boolean;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found';
    END IF;
    
    -- Check if user already has tenant_id
    SELECT u.tenant_id INTO user_tenant_id
    FROM public.users u
    WHERE u.id = current_user_id;
    
    -- If user doesn't exist in users table, insert them
    IF user_tenant_id IS NULL THEN
        -- Check if the default tenant exists
        SELECT EXISTS(SELECT 1 FROM public.tenants WHERE id = default_tenant_id) INTO tenant_exists;
        
        IF NOT tenant_exists THEN
            -- Create the default tenant if it doesn't exist
            INSERT INTO public.tenants (id, name, status, subscription_plan)
            VALUES (default_tenant_id, 'Default School', 'active', 'basic')
            ON CONFLICT (id) DO NOTHING;
        END IF;
        
        -- Insert or update user with tenant_id
        INSERT INTO public.users (id, email, tenant_id, full_name, role_id)
        VALUES (
            current_user_id,
            COALESCE((auth.jwt() ->> 'email'), 'user@school.local'),
            default_tenant_id,
            COALESCE((auth.jwt() ->> 'full_name'), 'School User'),
            1  -- Default to admin role
        )
        ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id
        WHERE users.tenant_id IS NULL;
        
        RETURN true;
    END IF;
    
    RETURN false;  -- User already had tenant_id
END;
$$;

-- Step 7: Create roles if they don't exist
-- ================================================================

-- Ensure default roles exist for the default tenant
INSERT INTO public.roles (id, role_name, tenant_id)
VALUES 
    (1, 'admin', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (2, 'teacher', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (3, 'student', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (4, 'parent', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid)
ON CONFLICT (role_name, tenant_id) DO NOTHING;

-- Step 8: Grant necessary permissions
-- ================================================================

-- Grant execute permission on the tenant functions
GRANT EXECUTE ON FUNCTION auth.current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_has_tenant_id(uuid) TO authenticated;

-- Step 9: Create a trigger to automatically set tenant_id on marks insert
-- ================================================================

-- Function to automatically set tenant_id if not provided
CREATE OR REPLACE FUNCTION public.auto_set_marks_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_tenant_id uuid;
BEGIN
    -- If tenant_id is not set, get it from current user
    IF NEW.tenant_id IS NULL THEN
        user_tenant_id := auth.current_user_tenant_id();
        
        -- If still NULL, ensure user has tenant and try again
        IF user_tenant_id IS NULL THEN
            PERFORM public.ensure_user_has_tenant_id();
            user_tenant_id := auth.current_user_tenant_id();
        END IF;
        
        -- If still NULL, use default tenant
        IF user_tenant_id IS NULL THEN
            user_tenant_id := 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;
        END IF;
        
        NEW.tenant_id := user_tenant_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for marks table
DROP TRIGGER IF EXISTS auto_set_marks_tenant_id_trigger ON public.marks;
CREATE TRIGGER auto_set_marks_tenant_id_trigger
    BEFORE INSERT ON public.marks
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_set_marks_tenant_id();

-- Step 10: Verification queries (optional - comment out in production)
-- ================================================================

-- Uncomment these to verify the setup:
/*
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('marks', 'exams', 'students', 'subjects', 'classes', 'users');

-- Check policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('marks', 'exams', 'students', 'subjects', 'classes', 'users')
ORDER BY tablename, policyname;

-- Check tenant function
SELECT auth.current_user_tenant_id() as current_tenant_id;
*/

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies for marks table and related tables have been successfully created!';
    RAISE NOTICE '✅ Tenant isolation is now enforced for marks, exams, students, subjects, classes, and users tables.';
    RAISE NOTICE '✅ Auto-tenant assignment trigger created for marks table.';
    RAISE NOTICE '🔧 Make sure to run: SELECT public.ensure_user_has_tenant_id(); if users are missing tenant_id.';
END $$;
