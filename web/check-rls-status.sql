-- Check current RLS status for your tables
-- Run this in Supabase SQL Editor to see current state

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS is ENABLED (blocking inserts)'
        ELSE '✅ RLS is DISABLED (inserts should work)'
    END as status
FROM pg_tables 
WHERE tablename IN ('users', 'tenants', 'roles')
    AND schemaname = 'public';

-- Also check for any existing policies
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'INSERT' THEN '📝 INSERT policy'
        WHEN cmd = 'SELECT' THEN '👀 SELECT policy'  
        WHEN cmd = 'UPDATE' THEN '✏️ UPDATE policy'
        WHEN cmd = 'DELETE' THEN '🗑️ DELETE policy'
        ELSE cmd
    END as policy_type
FROM pg_policies 
WHERE tablename IN ('users', 'tenants', 'roles')
ORDER BY tablename, cmd;
