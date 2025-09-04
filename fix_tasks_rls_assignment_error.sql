-- ==========================================
-- FIX TASKS RLS POLICIES FOR ASSIGNMENT ERROR
-- Focused fix for task assignment functionality
-- ==========================================

-- First, let's check if the tasks table has RLS enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing tasks policies to start fresh
DROP POLICY IF EXISTS "tasks_tenant_isolation" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Create a simple function to get tenant ID (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
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

-- ==========================================
-- TASKS TABLE RLS POLICIES
-- ==========================================

-- SELECT: Allow users to see tasks within their tenant
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
);

-- INSERT: Allow authenticated users to create tasks within their tenant
CREATE POLICY "tasks_insert" ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- UPDATE: Allow users to update tasks within their tenant
CREATE POLICY "tasks_update" ON public.tasks
FOR UPDATE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- DELETE: Allow users to delete tasks within their tenant
CREATE POLICY "tasks_delete" ON public.tasks
FOR DELETE TO authenticated
USING (
  tenant_id = public.get_user_tenant_id()
);

-- ==========================================
-- TENANT ENFORCEMENT TRIGGER FOR TASKS
-- ==========================================

-- Create or replace the tenant enforcement function for tasks
CREATE OR REPLACE FUNCTION public.enforce_tasks_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set tenant_id if not provided
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  
  -- Validate tenant_id matches user's tenant
  IF NEW.tenant_id != public.get_user_tenant_id() THEN
    RAISE EXCEPTION 'Cannot create/update task for different tenant';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS enforce_tasks_tenant_id ON public.tasks;

CREATE TRIGGER enforce_tasks_tenant_id
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tasks_tenant_id();

-- ==========================================
-- VERIFICATION
-- ==========================================

-- Check if policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'tasks' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Test if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tasks' 
  AND schemaname = 'public';

COMMENT ON FUNCTION public.get_user_tenant_id() IS 'Returns current user tenant ID for tasks RLS';
COMMENT ON FUNCTION public.enforce_tasks_tenant_id() IS 'Enforces tenant_id for tasks table operations';

SELECT 'Tasks RLS policies updated successfully' as status;
