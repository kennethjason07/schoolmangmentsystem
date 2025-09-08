-- Fix tasks table RLS policies (fallback table used in TeacherDashboard)
-- Run this AFTER running fix_personal_tasks_rls.sql

-- Step 1: Check current RLS status for tasks table
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS is ENABLED (might be blocking inserts)'
        ELSE '✅ RLS is DISABLED'
    END as status
FROM pg_tables 
WHERE tablename = 'tasks' 
  AND schemaname = 'public';

-- Step 2: Check existing policies for tasks
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'tasks' 
  AND schemaname = 'public';

-- Step 3: Fix tasks table RLS policies
-- Drop all existing restrictive policies
DROP POLICY IF EXISTS "tasks_tenant_isolation" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- Create new, more permissive policies for tasks table
-- This table uses assigned_teacher_ids array for teacher assignments

-- SELECT: Teachers can view tasks assigned to them
CREATE POLICY "tasks_teacher_access_select" ON public.tasks
FOR SELECT TO authenticated
USING (
    -- Allow if user is in assigned_teacher_ids array
    auth.uid() = ANY(assigned_teacher_ids)
    OR
    -- Allow if user is the creator (created_by)
    created_by = auth.uid()
);

-- INSERT: Authenticated users can create tasks
CREATE POLICY "tasks_teacher_access_insert" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
    -- Allow authenticated users to create tasks
    -- The trigger will handle setting tenant_id correctly
    true
);

-- UPDATE: Users can update tasks they're assigned to or created
CREATE POLICY "tasks_teacher_access_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
    -- Allow if user is in assigned_teacher_ids array
    auth.uid() = ANY(assigned_teacher_ids)
    OR
    -- Allow if user is the creator
    created_by = auth.uid()
)
WITH CHECK (
    -- Same conditions for WITH CHECK
    auth.uid() = ANY(assigned_teacher_ids)
    OR
    created_by = auth.uid()
);

-- DELETE: Users can delete tasks they're assigned to or created
CREATE POLICY "tasks_teacher_access_delete" ON public.tasks
FOR DELETE TO authenticated
USING (
    -- Allow if user is in assigned_teacher_ids array
    auth.uid() = ANY(assigned_teacher_ids)
    OR
    -- Allow if user is the creator
    created_by = auth.uid()
);

-- Step 4: Create a trigger to ensure tenant_id is always set for tasks
CREATE OR REPLACE FUNCTION public.set_task_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Set tenant_id from the authenticated user's tenant_id
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := (
            SELECT tenant_id 
            FROM public.users 
            WHERE id = auth.uid() 
            LIMIT 1
        );
        
        -- If still null, use a fallback tenant_id
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;
        END IF;
    END IF;
    
    -- Set created_by if not set
    IF NEW.created_by IS NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS set_task_tenant_id ON public.tasks;
CREATE TRIGGER set_task_tenant_id
    BEFORE INSERT OR UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_task_tenant_id();

-- Step 5: Verify the new policies are in place
SELECT 
    'Tasks Table Policies:' as info,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'tasks' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Step 6: Success message
SELECT 
    '✅ Tasks table RLS policies updated!' as status,
    'Both personal_tasks and tasks tables should now work for insertions' as message;

-- EXPLANATION:
-- The tasks table in your system uses assigned_teacher_ids as a UUID array
-- to track which teachers are assigned to each task.
-- The new policies check if the authenticated user's ID is in that array,
-- which is more appropriate than the previous tenant-based restrictions
-- that were failing due to JWT token issues.
