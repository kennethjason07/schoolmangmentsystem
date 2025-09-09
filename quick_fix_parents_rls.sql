-- QUICK FIX: Temporarily disable RLS on parents table to allow admin operations
-- This is a temporary solution to get parent account creation working immediately

-- Option 1: Temporarily disable RLS on parents table
ALTER TABLE parents DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'parents';

-- Note: To re-enable RLS later when you have proper policies, run:
-- ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
