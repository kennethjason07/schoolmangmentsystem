-- Alternative approach to fix INSERT policy
-- Sometimes WITH CHECK doesn't work properly in certain PostgreSQL versions
-- Let's try a different approach

-- Drop all policies and start fresh
DROP POLICY IF EXISTS "tenant_insert_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_select_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_update_upi_settings" ON public.school_upi_settings;
DROP POLICY IF EXISTS "tenant_delete_upi_settings" ON public.school_upi_settings;

-- Create a single comprehensive policy that covers all operations
-- This approach sometimes works better than separate policies
CREATE POLICY "tenant_all_operations_upi_settings" ON public.school_upi_settings
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Alternative: Create INSERT policy with USING instead of WITH CHECK
CREATE POLICY "tenant_insert_upi_settings_v2" ON public.school_upi_settings
  FOR INSERT
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Verify both policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'school_upi_settings' 
ORDER BY policyname;

-- Test if the user lookup is working at all
SELECT 
  'Current auth.uid():' as label, 
  auth.uid() as value
UNION ALL
SELECT 
  'User exists in users table:', 
  CASE WHEN EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid()) 
       THEN 'YES' 
       ELSE 'NO' 
  END
UNION ALL
SELECT 
  'User tenant_id:', 
  COALESCE(
    (SELECT tenant_id::text FROM public.users WHERE id = auth.uid()), 
    'NULL or not found'
  );
