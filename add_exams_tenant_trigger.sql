-- Add enforce_tenant_id trigger to the exams table
-- This ensures that the tenant_id is automatically assigned during INSERT/UPDATE operations
-- This provides additional safety for tenant isolation in the exams table

-- Create the trigger for the exams table
CREATE TRIGGER enforce_tenant_id_exams
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- Verify that the existing enforce_tenant_id function exists and is correct
-- (This should already exist from the RLS policies, but let's make sure)
-- The function should:
-- 1. Set tenant_id from JWT if not already set
-- 2. Ensure tenant_id matches JWT
-- 3. Raise exception if tenant_id mismatch

COMMENT ON TRIGGER enforce_tenant_id_exams ON public.exams IS 'Ensures tenant_id is properly assigned and validated for exam records';

-- Test the trigger by checking if it exists
SELECT tgname, tgrelid::regclass, tgenabled, tgdef
FROM pg_trigger 
WHERE tgrelid = 'public.exams'::regclass 
AND tgname = 'enforce_tenant_id_exams';

-- If you need to drop and recreate the trigger, use:
-- DROP TRIGGER IF EXISTS enforce_tenant_id_exams ON public.exams;
