-- ==========================================
-- ADD EXAMS TABLE TENANT ENFORCEMENT TRIGGER
-- ==========================================
-- Since the enforce_tenant_id function already exists, we just need to add the trigger

-- Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS enforce_tenant_id_exams ON public.exams;

-- Create the trigger for the exams table
CREATE TRIGGER enforce_tenant_id_exams
  BEFORE INSERT OR UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- Add comment to document the trigger
COMMENT ON TRIGGER enforce_tenant_id_exams ON public.exams IS 'Ensures tenant_id is properly assigned and validated for exam records';

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check if the trigger was created successfully
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger 
WHERE tgrelid = 'public.exams'::regclass 
AND tgname = 'enforce_tenant_id_exams';

-- Check if RLS is enabled on exams table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'exams';

-- Check existing RLS policies on exams table
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'exams'
ORDER BY policyname;

-- Show the exams table structure to confirm tenant_id column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'exams'
ORDER BY ordinal_position;
