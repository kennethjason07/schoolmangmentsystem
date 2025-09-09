-- FIXED VERSION - Compatible with older PostgreSQL versions
-- This removes the forcerowsecurity column that doesn't exist in older versions

-- STEP 1: Check current RLS status (without forcerowsecurity)
SELECT 'Current RLS Status' as info_type, 
       schemaname, 
       tablename, 
       rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'parents';

-- STEP 2: Check existing policies
SELECT 'Current Policies' as info_type,
       policyname, 
       cmd, 
       roles
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'parents';

-- STEP 3: IMMEDIATE FIX - Disable RLS
ALTER TABLE parents DISABLE ROW LEVEL SECURITY;

-- STEP 4: Verify RLS is now disabled
SELECT 'After Disable' as info_type,
       CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'parents';

-- STEP 5: Check for duplicate auth accounts
SELECT 'Duplicate Check' as info_type,
       email, 
       COUNT(*) as account_count
FROM auth.users 
WHERE email = 'arshadpatel1431@gmail.com'
GROUP BY email;

-- STEP 6: Show all accounts for this email
SELECT 'All Accounts' as info_type,
       au.id as auth_id,
       au.email,
       au.created_at,
       CASE WHEN u.id IS NOT NULL THEN 'Has User Record' ELSE 'No User Record' END as user_record_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'arshadpatel1431@gmail.com'
ORDER BY au.created_at DESC;
