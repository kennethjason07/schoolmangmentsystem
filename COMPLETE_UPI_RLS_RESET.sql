-- COMPLETE RESET OF UPI SETTINGS RLS POLICIES
-- Based on the actual schema structure from schema.txt

-- First, drop ALL existing policies on school_upi_settings table
DROP POLICY IF EXISTS "Users can view school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Admin can insert school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Admin can update school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Admin can delete school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Users can insert school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Users can update school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Users can delete school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Authenticated users can insert UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Authenticated users can update UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Authenticated users can delete UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Authenticated users can view UPI settings for their tenant" ON public.school_upi_settings;

-- Grant basic permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_upi_settings TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE public.school_upi_settings ENABLE ROW LEVEL SECURITY;

-- Create simple, working policies based on the actual schema structure
-- The schema shows that users.tenant_id exists and matches school_upi_settings.tenant_id

-- Policy 1: Allow users to SELECT UPI settings for their tenant
CREATE POLICY "tenant_select_upi_settings" ON public.school_upi_settings
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Policy 2: Allow users to INSERT UPI settings for their tenant
CREATE POLICY "tenant_insert_upi_settings" ON public.school_upi_settings
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND tenant_id IS NOT NULL
  );

-- Policy 3: Allow users to UPDATE UPI settings for their tenant
CREATE POLICY "tenant_update_upi_settings" ON public.school_upi_settings
  FOR UPDATE
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Policy 4: Allow users to DELETE UPI settings for their tenant
CREATE POLICY "tenant_delete_upi_settings" ON public.school_upi_settings
  FOR DELETE
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'school_upi_settings' 
ORDER BY policyname;

-- Test query to verify current user's tenant_id (for debugging)
SELECT 
  u.id as user_id,
  u.tenant_id,
  u.email,
  r.role_name
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
WHERE u.id = auth.uid();

COMMIT;
