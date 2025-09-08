-- Fix the INSERT policy that has null qual
-- This is causing the INSERT RLS violation

-- Drop the broken INSERT policy
DROP POLICY IF EXISTS "tenant_insert_upi_settings" ON public.school_upi_settings;

-- Recreate the INSERT policy with proper syntax
CREATE POLICY "tenant_insert_upi_settings" ON public.school_upi_settings
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Verify the policy was created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'school_upi_settings' AND policyname = 'tenant_insert_upi_settings';

-- Test the current user's tenant_id to ensure it's not null
SELECT 
  auth.uid() as current_user_id,
  u.tenant_id,
  u.email,
  CASE WHEN u.tenant_id IS NULL THEN 'ERROR: tenant_id is NULL' ELSE 'OK: tenant_id found' END as status
FROM public.users u
WHERE u.id = auth.uid();
