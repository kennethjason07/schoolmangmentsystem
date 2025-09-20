-- TEMPORARY: Disable RLS on classes table for testing
-- ⚠️ WARNING: This removes security restrictions temporarily
-- Only use this for testing, then re-enable RLS with proper policies

-- Disable RLS on classes table
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;

-- Test your deletion now - it should work

-- After testing, RE-ENABLE RLS with proper policies:
-- ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

-- Then add the proper DELETE policy:
-- CREATE POLICY "Enable delete for authenticated users on own tenant classes"
-- ON classes FOR DELETE TO authenticated
-- USING (tenant_id = (SELECT tenant_id FROM user_profiles WHERE user_id = auth.uid()));