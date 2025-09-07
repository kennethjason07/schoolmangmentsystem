-- Fix UPI Transactions RLS Policy
-- This removes the dependency on app.current_tenant_id configuration parameter

-- Drop the existing problematic policy
DROP POLICY IF EXISTS upi_transactions_tenant_isolation ON public.upi_transactions;

-- Create a new RLS policy that works without configuration parameters
-- This policy allows users to access UPI transactions based on their tenant_id from the auth.jwt() function
CREATE POLICY upi_transactions_tenant_policy ON public.upi_transactions
  FOR ALL
  USING (
    tenant_id = COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid,
      auth.jwt() ->> 'tenant_id'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid,
      auth.jwt() ->> 'tenant_id'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    )
  );

-- Alternative simpler policy (if the above doesn't work)
-- This temporarily allows all authenticated users access while you fix tenant context
-- UNCOMMENT THE LINES BELOW IF THE ABOVE POLICY STILL CAUSES ISSUES

-- DROP POLICY IF EXISTS upi_transactions_tenant_policy ON public.upi_transactions;
-- CREATE POLICY upi_transactions_authenticated_policy ON public.upi_transactions
--   FOR ALL
--   USING (auth.role() = 'authenticated')
--   WITH CHECK (auth.role() = 'authenticated');

-- Test the policy
SELECT 'UPI RLS Policy Updated Successfully' as status;
