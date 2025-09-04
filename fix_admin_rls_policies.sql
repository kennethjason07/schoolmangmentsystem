-- Fix RLS policies for admin users
-- This script ensures admin users can create and manage tasks

-- First, let's create/fix the get_current_tenant_id function
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Try to get tenant_id from JWT claims
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'tenant_id')::text, ''),
    -- Fallback: get from users table
    (SELECT tenant_id::text FROM public.users WHERE id = auth.uid() LIMIT 1),
    -- Final fallback for single-tenant deployment
    'b8f8b5f0-1234-4567-8901-123456789000'
  )::uuid;
$$;

-- Create admin check function for the specific tenant
CREATE OR REPLACE FUNCTION public.is_admin_current_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid()
      AND r.role_name IN ('admin', 'super_admin')
      AND u.tenant_id = public.get_current_tenant_id()
  );
$$;

-- Drop existing tasks policies that might be too restrictive
DROP POLICY IF EXISTS "tasks_tenant_isolation" ON public.tasks;
DROP POLICY IF EXISTS "service_role_bypass_tasks" ON public.tasks;
DROP POLICY IF EXISTS "admin_full_access_tasks" ON public.tasks;

-- Create a comprehensive admin-friendly policy for tasks
CREATE POLICY "tasks_admin_full_access" ON public.tasks
  FOR ALL 
  TO authenticated
  USING (
    -- Allow if user is admin in the current tenant
    public.is_admin_current_user() AND tenant_id = public.get_current_tenant_id()
  )
  WITH CHECK (
    -- Allow insert/update if user is admin and tenant_id matches
    public.is_admin_current_user() AND tenant_id = public.get_current_tenant_id()
  );

-- Create a service role bypass policy for tasks (for system operations)
CREATE POLICY "tasks_service_role_bypass" ON public.tasks
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update the enforce_tenant_id trigger function to be more flexible for admins
CREATE OR REPLACE FUNCTION public.enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set tenant_id from current context if not already set
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_current_tenant_id();
  END IF;
  
  -- For admin users, allow them to create records for their tenant
  IF public.is_admin_current_user() THEN
    -- Ensure the tenant_id matches the admin's tenant
    IF NEW.tenant_id != public.get_current_tenant_id() THEN
      NEW.tenant_id := public.get_current_tenant_id();
    END IF;
  ELSE
    -- For non-admin users, enforce strict tenant matching
    IF NEW.tenant_id != public.get_current_tenant_id() THEN
      RAISE EXCEPTION 'Cannot create/modify record for different tenant. Expected: %, Got: %', 
        public.get_current_tenant_id(), NEW.tenant_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_current_user() TO authenticated;

-- Ensure the authenticated role can access the tasks table
GRANT ALL ON public.tasks TO authenticated;

-- Display success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADMIN RLS POLICIES FIXED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Fixed get_current_tenant_id() function to read from JWT';
  RAISE NOTICE '- Created is_admin_current_user() function';  
  RAISE NOTICE '- Updated tasks table RLS policies for admin access';
  RAISE NOTICE '- Made tenant enforcement more flexible for admins';
  RAISE NOTICE '- Granted necessary permissions';
  RAISE NOTICE '========================================';
END $$;
