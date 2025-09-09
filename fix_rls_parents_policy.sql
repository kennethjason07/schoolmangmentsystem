-- FIX RLS POLICY ISSUES FOR PARENTS TABLE
-- This script will investigate and fix Row Level Security policy issues

-- Step 1: Check current RLS policies on parents table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'parents';

-- Step 2: Check if RLS is enabled on parents table
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'parents';

-- Step 3: Check current user's roles and permissions
SELECT 
    current_user as current_database_user,
    session_user as session_user,
    current_role as current_role;

-- Step 4: Check what roles exist in the auth system
SELECT 
    r.rolname,
    r.rolsuper,
    r.rolinherit,
    r.rolcreaterole,
    r.rolcreatedb,
    r.rolcanlogin,
    r.rolreplication,
    r.rolbypassrls
FROM pg_roles r
WHERE r.rolname LIKE '%service%' OR r.rolname LIKE '%auth%' OR r.rolname = current_user;

-- Step 5: Temporary fix - Disable RLS on parents table for admin operations
-- UNCOMMENT THE LINE BELOW TO DISABLE RLS TEMPORARILY
-- ALTER TABLE parents DISABLE ROW LEVEL SECURITY;

-- Step 6: Better fix - Create/update RLS policy to allow admin operations
-- This creates a policy that allows INSERT for authenticated users in the same tenant

-- First, let's see if there's already a policy for INSERT
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'parents' 
AND cmd = 'INSERT';

-- Step 7: Create a proper INSERT policy for parents table
-- This policy allows INSERT when:
-- 1. User is authenticated (has a user record)
-- 2. The tenant_id matches the user's tenant_id

DROP POLICY IF EXISTS "parents_insert_policy" ON parents;

CREATE POLICY "parents_insert_policy" ON parents
FOR INSERT 
TO authenticated
WITH CHECK (
    -- Allow insert if the user is in the same tenant as the parent record
    tenant_id IN (
        SELECT u.tenant_id 
        FROM auth.users au
        JOIN public.users u ON au.id = u.id
        WHERE au.id = auth.uid()
    )
    OR
    -- Allow insert for service role (admin operations)
    auth.role() = 'service_role'
);

-- Step 8: Create a proper SELECT policy for parents table if it doesn't exist
DROP POLICY IF EXISTS "parents_select_policy" ON parents;

CREATE POLICY "parents_select_policy" ON parents
FOR SELECT
TO authenticated
USING (
    -- Allow select if the user is in the same tenant
    tenant_id IN (
        SELECT u.tenant_id 
        FROM auth.users au
        JOIN public.users u ON au.id = u.id
        WHERE au.id = auth.uid()
    )
    OR
    -- Allow select for service role
    auth.role() = 'service_role'
);

-- Step 9: Create UPDATE policy for parents table
DROP POLICY IF EXISTS "parents_update_policy" ON parents;

CREATE POLICY "parents_update_policy" ON parents
FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM auth.users au
        JOIN public.users u ON au.id = u.id
        WHERE au.id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
)
WITH CHECK (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM auth.users au
        JOIN public.users u ON au.id = u.id
        WHERE au.id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
);

-- Step 10: Create DELETE policy for parents table
DROP POLICY IF EXISTS "parents_delete_policy" ON parents;

CREATE POLICY "parents_delete_policy" ON parents
FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM auth.users au
        JOIN public.users u ON au.id = u.id
        WHERE au.id = auth.uid()
    )
    OR
    auth.role() = 'service_role'
);

-- Step 11: Ensure RLS is enabled (this should be the case)
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;

-- Step 12: Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON parents TO authenticated;

-- Step 13: Verify the policies were created
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'parents'
ORDER BY cmd, policyname;

-- Step 14: Test query to see if the policy works
-- This should show policies that would apply to the current user
SELECT 
    'Policy Test' as test_type,
    auth.uid() as current_auth_user,
    auth.role() as current_auth_role,
    current_user as current_db_user;

-- Step 15: Check if the current authenticated user has a matching record
SELECT 
    'User Tenant Check' as test_type,
    au.id as auth_user_id,
    u.id as user_record_id,
    u.tenant_id,
    u.email,
    u.full_name
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.id = auth.uid();
