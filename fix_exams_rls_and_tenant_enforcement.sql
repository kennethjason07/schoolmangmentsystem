-- ==========================================
-- FIX EXAMS TABLE RLS POLICIES AND TENANT ENFORCEMENT
-- ==========================================
-- This script ensures proper tenant isolation for the exams table
-- and adds the missing trigger for automatic tenant_id assignment

-- First, let's ensure the exams table has RLS enabled
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

-- Drop existing exams policies if they exist to recreate them properly
DROP POLICY IF EXISTS "exams_tenant_isolation" ON public.exams;

-- Create comprehensive RLS policy for exams table
-- This policy allows users to access only exams from their own tenant
CREATE POLICY "exams_tenant_isolation" ON public.exams
  FOR ALL 
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
  WITH CHECK (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- Create specific policies for different operations to be more granular
-- SELECT policy - users can view exams from their tenant
CREATE POLICY "exams_select_policy" ON public.exams
  FOR SELECT 
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- INSERT policy - users can create exams for their tenant
CREATE POLICY "exams_insert_policy" ON public.exams
  FOR INSERT 
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    tenant_id IS NOT NULL
  );

-- UPDATE policy - users can update exams from their tenant
CREATE POLICY "exams_update_policy" ON public.exams
  FOR UPDATE 
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    tenant_id IS NOT NULL
  );

-- DELETE policy - users can delete exams from their tenant
CREATE POLICY "exams_delete_policy" ON public.exams
  FOR DELETE 
  USING (tenant_id::text = auth.jwt() ->> 'tenant_id');

-- ==========================================
-- TENANT ENFORCEMENT TRIGGER
-- ==========================================

-- Ensure the enforce_tenant_id function exists
-- This function should already exist from the main RLS setup, but let's verify it
CREATE OR REPLACE FUNCTION public.enforce_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set tenant_id from JWT if not already set
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
  END IF;
  
  -- Ensure tenant_id matches JWT (security check)
  IF NEW.tenant_id::text != auth.jwt() ->> 'tenant_id' THEN
    RAISE EXCEPTION 'Cannot create record for different tenant. Expected: %, Got: %', 
      auth.jwt() ->> 'tenant_id', NEW.tenant_id;
  END IF;
  
  -- Final check that tenant_id is not null
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id cannot be null. User must have valid tenant context.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_tenant_id_exams ON public.exams;

-- Create the trigger for the exams table
CREATE TRIGGER enforce_tenant_id_exams
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- Add comment to document the trigger
COMMENT ON TRIGGER enforce_tenant_id_exams ON public.exams IS 'Ensures tenant_id is properly assigned and validated for exam records';

-- ==========================================
-- ROLE-BASED POLICIES FOR ADMINS
-- ==========================================

-- Admin users should have full access to exams within their tenant
CREATE POLICY "exams_admin_access" ON public.exams
  FOR ALL 
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'super_admin')
  )
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'super_admin') AND
    tenant_id IS NOT NULL
  );

-- Teacher users should be able to view exams for classes they teach
-- and create/update exams for their classes
CREATE POLICY "exams_teacher_access" ON public.exams
  FOR ALL 
  USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' = 'teacher' AND
    (
      -- Teachers can access exams for classes they teach
      EXISTS (
        SELECT 1 FROM public.teacher_subjects ts
        JOIN public.subjects s ON ts.subject_id = s.id
        WHERE ts.teacher_id = (auth.jwt() ->> 'linked_teacher_id')::uuid
          AND s.class_id = exams.class_id
          AND s.tenant_id::text = auth.jwt() ->> 'tenant_id'
      )
    )
  )
  WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' = 'teacher' AND
    tenant_id IS NOT NULL
  );

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check if RLS is enabled on exams table
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'exams';

-- Check existing policies on exams table
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'exams';

-- Check if the trigger exists
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger 
WHERE tgrelid = 'public.exams'::regclass 
AND tgname = 'enforce_tenant_id_exams';

-- Test the enforce_tenant_id function exists
SELECT proname, pronargs, prorettype::regtype
FROM pg_proc 
WHERE proname = 'enforce_tenant_id' AND pronamespace = 'public'::regnamespace;

-- ==========================================
-- CLEANUP OLD POLICIES (if needed)
-- ==========================================

-- If you need to clean up and start fresh, uncomment these lines:
-- DROP POLICY IF EXISTS "exams_tenant_isolation" ON public.exams;
-- DROP POLICY IF EXISTS "exams_select_policy" ON public.exams;
-- DROP POLICY IF EXISTS "exams_insert_policy" ON public.exams;
-- DROP POLICY IF EXISTS "exams_update_policy" ON public.exams;
-- DROP POLICY IF EXISTS "exams_delete_policy" ON public.exams;
-- DROP POLICY IF EXISTS "exams_admin_access" ON public.exams;
-- DROP POLICY IF EXISTS "exams_teacher_access" ON public.exams;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Ensure the public schema and tables are accessible
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.exams TO anon;  -- Only if you want anonymous read access

COMMENT ON TABLE public.exams IS 'Exams table with tenant isolation via RLS policies and automatic tenant_id enforcement';
