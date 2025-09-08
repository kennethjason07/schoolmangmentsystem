-- Temporarily disable RLS to test if the issue is with RLS itself
-- This will help us isolate whether the problem is with the policies or something else

-- Step 1: Disable RLS temporarily for testing
ALTER TABLE public.school_upi_settings DISABLE ROW LEVEL SECURITY;

-- Test 1: Try inserting without RLS to confirm the table works
-- (You can test this from your app now to see if it works without RLS)

-- Step 2: If the above works, re-enable RLS and try a super simple policy
ALTER TABLE public.school_upi_settings ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "delete_own_tenant_upi" ON public.school_upi_settings;
DROP POLICY IF EXISTS "insert_own_tenant_upi" ON public.school_upi_settings;
DROP POLICY IF EXISTS "select_own_tenant_upi" ON public.school_upi_settings;
DROP POLICY IF EXISTS "update_own_tenant_upi" ON public.school_upi_settings;

-- Create the most permissive policy possible for testing
-- This allows any authenticated user to do anything (NOT for production!)
CREATE POLICY "allow_all_for_authenticated" ON public.school_upi_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify the policy
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'school_upi_settings';

-- Alternative: If the above doesn't work, try creating individual policies with simpler conditions
/*
DROP POLICY IF EXISTS "allow_all_for_authenticated" ON public.school_upi_settings;

CREATE POLICY "simple_select" ON public.school_upi_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "simple_insert" ON public.school_upi_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "simple_update" ON public.school_upi_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "simple_delete" ON public.school_upi_settings
  FOR DELETE
  TO authenticated
  USING (true);
*/
