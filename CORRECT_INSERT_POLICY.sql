-- Correct INSERT policy fix
-- PostgreSQL requires WITH CHECK for INSERT operations, not USING

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "tenant_insert_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_insert_upi_settings_v2" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_all_operations_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_select_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_update_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_delete_upi_settings" ON public.school_upi_settings;

-- Create SELECT policy
CREATE POLICY "select_own_tenant_upi" ON public.school_upi_settings
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Create INSERT policy with correct WITH CHECK syntax
CREATE POLICY "insert_own_tenant_upi" ON public.school_upi_settings
  FOR INSERT
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Create UPDATE policy
CREATE POLICY "update_own_tenant_upi" ON public.school_upi_settings
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Create DELETE policy
CREATE POLICY "delete_own_tenant_upi" ON public.school_upi_settings
  FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Verify all policies were created correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'school_upi_settings' 
ORDER BY policyname;
