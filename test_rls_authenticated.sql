-- Test to verify RLS policies are working for authenticated users
-- Run this in Supabase SQL Editor to debug the issue

-- 1. Check existing RLS policies
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
WHERE tablename IN ('users', 'roles', 'tenants')
ORDER BY tablename, policyname;

-- 2. Check if RLS is enabled on tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('users', 'roles', 'tenants')
    AND schemaname = 'public';

-- 3. Test access as anon user
SET ROLE anon;
SELECT 'Testing as anon role:' as test_phase;

-- Can anon read users?
SELECT COUNT(*) as users_count FROM users;

-- Can anon read roles?
SELECT COUNT(*) as roles_count FROM roles;

-- Can anon read specific user?
SELECT id, email, full_name, role_id FROM users WHERE email = 'kenj7214@gmail.com';

-- 4. Reset to authenticated role
RESET ROLE;
SELECT 'Testing as authenticated role:' as test_phase;

-- Can authenticated read users?
SELECT COUNT(*) as users_count FROM users;

-- Can authenticated read roles?  
SELECT COUNT(*) as roles_count FROM roles;

-- Can authenticated read specific user?
SELECT id, email, full_name, role_id FROM users WHERE email = 'kenj7214@gmail.com';

-- 5. Check what the current role is
SELECT current_user, session_user;

-- 6. Show any authentication-related functions
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'auth' 
   OR routine_name LIKE '%auth%' 
   OR routine_name LIKE '%user%'
ORDER BY routine_name;
