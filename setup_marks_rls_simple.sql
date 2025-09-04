-- ================================================================
-- SIMPLIFIED RLS POLICIES SETUP FOR MARKS TABLE
-- ================================================================
-- This script sets up Row Level Security policies for the marks table
-- without requiring auth schema permissions

-- Step 1: Create tenant context function in public schema
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    tenant_uuid uuid;
    current_user_id uuid;
    default_tenant_id uuid := 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;
BEGIN
    -- Get the current authenticated user ID
    current_user_id := auth.uid();
    
    -- If no authenticated user, return default tenant
    IF current_user_id IS NULL THEN
        RETURN default_tenant_id;
    END IF;
    
    -- Try to get tenant_id from users table
    SELECT u.tenant_id INTO tenant_uuid
    FROM public.users u
    WHERE u.id = current_user_id;
    
    -- If found, return it
    IF tenant_uuid IS NOT NULL THEN
        RETURN tenant_uuid;
    END IF;
    
    -- Try to get from JWT claims
    BEGIN
        tenant_uuid := (auth.jwt() ->> 'tenant_id')::uuid;
        IF tenant_uuid IS NOT NULL THEN
            RETURN tenant_uuid;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            -- Continue to fallback
            NULL;
    END;
    
    -- Fallback to default tenant
    RETURN default_tenant_id;
END;
$$;

-- Step 2: Enable RLS on marks table
-- ================================================================

ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies if they exist
-- ================================================================

DROP POLICY IF EXISTS "tenant_marks_select" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_insert" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_update" ON public.marks;
DROP POLICY IF EXISTS "tenant_marks_delete" ON public.marks;

-- Step 4: Create RLS policies for marks table using public function
-- ================================================================

-- Policy for SELECT: Users can see marks from their tenant (or all if no tenant context)
CREATE POLICY "tenant_marks_select" 
ON public.marks 
FOR SELECT 
TO authenticated 
USING (
    tenant_id = public.get_current_user_tenant_id()
    OR public.get_current_user_tenant_id() IS NULL
);

-- Policy for INSERT: Users can insert marks with their tenant_id
CREATE POLICY "tenant_marks_insert" 
ON public.marks 
FOR INSERT 
TO authenticated 
WITH CHECK (
    tenant_id = public.get_current_user_tenant_id()
);

-- Policy for UPDATE: Users can update marks from their tenant
CREATE POLICY "tenant_marks_update" 
ON public.marks 
FOR UPDATE 
TO authenticated 
USING (
    tenant_id = public.get_current_user_tenant_id()
)
WITH CHECK (
    tenant_id = public.get_current_user_tenant_id()
);

-- Policy for DELETE: Users can delete marks from their tenant
CREATE POLICY "tenant_marks_delete" 
ON public.marks 
FOR DELETE 
TO authenticated 
USING (
    tenant_id = public.get_current_user_tenant_id()
);

-- Step 5: Ensure default tenant exists
-- ================================================================

INSERT INTO public.tenants (id, name, status, subscription_plan)
VALUES (
    'b8f8b5f0-1234-4567-8901-123456789000'::uuid, 
    'Default School', 
    'active', 
    'basic'
)
ON CONFLICT (id) DO NOTHING;

-- Step 6: Ensure default roles exist
-- ================================================================

INSERT INTO public.roles (id, role_name, tenant_id)
VALUES 
    (1, 'admin', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (2, 'teacher', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (3, 'student', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid),
    (4, 'parent', 'b8f8b5f0-1234-4567-8901-123456789000'::uuid)
ON CONFLICT (role_name, tenant_id) DO NOTHING;

-- Step 7: Update existing users to have tenant_id if missing
-- ================================================================

-- Update users who don't have tenant_id
UPDATE public.users 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid
WHERE tenant_id IS NULL;

-- Step 8: Create trigger to auto-assign tenant_id on marks insert
-- ================================================================

CREATE OR REPLACE FUNCTION public.auto_assign_marks_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    user_tenant_id uuid;
BEGIN
    -- If tenant_id is already set, keep it
    IF NEW.tenant_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get tenant_id for current user
    user_tenant_id := public.get_current_user_tenant_id();
    
    -- Assign the tenant_id
    NEW.tenant_id := user_tenant_id;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_assign_marks_tenant_trigger ON public.marks;
CREATE TRIGGER auto_assign_marks_tenant_trigger
    BEFORE INSERT ON public.marks
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_marks_tenant();

-- Step 9: Grant permissions
-- ================================================================

GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_marks_tenant() TO authenticated;

-- Step 10: Also enable RLS on related tables (optional)
-- ================================================================

-- Enable RLS on related tables for consistency
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- Simple policies for related tables (allow all for same tenant)
-- You can make these more restrictive based on your needs

-- Exams policies
DROP POLICY IF EXISTS "tenant_exams_all" ON public.exams;
CREATE POLICY "tenant_exams_all" 
ON public.exams 
FOR ALL 
TO authenticated 
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- Students policies  
DROP POLICY IF EXISTS "tenant_students_all" ON public.students;
CREATE POLICY "tenant_students_all" 
ON public.students 
FOR ALL 
TO authenticated 
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- Subjects policies
DROP POLICY IF EXISTS "tenant_subjects_all" ON public.subjects;
CREATE POLICY "tenant_subjects_all" 
ON public.subjects 
FOR ALL 
TO authenticated 
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- Classes policies
DROP POLICY IF EXISTS "tenant_classes_all" ON public.classes;
CREATE POLICY "tenant_classes_all" 
ON public.classes 
FOR ALL 
TO authenticated 
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Simplified RLS policies for marks table have been created!';
    RAISE NOTICE '✅ Default tenant and roles have been set up.';
    RAISE NOTICE '✅ Users without tenant_id have been updated.';
    RAISE NOTICE '✅ Auto-tenant assignment trigger created for marks.';
    RAISE NOTICE '📋 You can now test saving marks - they should automatically get the correct tenant_id.';
END $$;
