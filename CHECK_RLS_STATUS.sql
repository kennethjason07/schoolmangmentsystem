-- Check RLS (Row Level Security) status on UPI-related tables

-- 1. Check if RLS is enabled on school_upi_settings table
SELECT 
  'RLS Status Check' as section,
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS ENABLED'
    WHEN rowsecurity = false THEN '❌ RLS DISABLED' 
    ELSE 'Unknown'
  END as rls_status
FROM pg_tables 
WHERE tablename IN ('school_upi_settings', 'upi_transactions')
ORDER BY tablename;

-- 2. Check what policies exist (even if RLS is disabled)
SELECT 
  'Current Policies' as section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual IS NULL THEN 'NULL (might be broken)'
    WHEN qual = 'true' THEN 'PERMISSIVE (allows all)'
    ELSE 'RESTRICTIVE'
  END as policy_type
FROM pg_policies 
WHERE tablename IN ('school_upi_settings', 'upi_transactions')
ORDER BY tablename, policyname;

-- 3. If RLS is disabled, let's enable it and create proper policies
-- (Don't run this part yet - just for reference)

/*
-- Enable RLS on both tables
ALTER TABLE public.school_upi_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upi_transactions ENABLE ROW LEVEL SECURITY;

-- Drop any existing broken policies first
DROP POLICY IF EXISTS "allow_all_for_authenticated" ON public.school_upi_settings;

-- Create proper tenant-based policies for school_upi_settings
CREATE POLICY "tenant_access_upi_settings" ON public.school_upi_settings
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Create proper tenant-based policies for upi_transactions  
CREATE POLICY "tenant_access_upi_transactions" ON public.upi_transactions
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
*/
