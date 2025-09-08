-- Simple check for RLS status
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('school_upi_settings', 'upi_transactions')
ORDER BY tablename;
