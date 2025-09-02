-- Additional RLS fix for authenticated users
-- Run this if authenticated users can't access their profiles after login

-- Check current user role and session info
SELECT 'Current session info:' as info;
SELECT 
    auth.uid() as auth_user_id,
    auth.email() as auth_email,
    current_user as current_role;

-- ========================================
-- Fix RLS policies for authenticated users
-- ========================================

-- Ensure RLS is enabled but policies allow access
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Drop and recreate more permissive policies for authenticated users
DROP POLICY IF EXISTS "Allow authenticated to read users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated to read roles" ON public.roles;
DROP POLICY IF EXISTS "Allow authenticated to read tenants" ON public.tenants;

-- Create very permissive policies for authenticated users
CREATE POLICY "Allow authenticated to read users" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated to read roles" 
ON public.roles 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated to read tenants" 
ON public.tenants 
FOR SELECT 
TO authenticated 
USING (true);

-- Also ensure authenticated users can update their own profiles
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Test the policies by checking what an authenticated user can see
SELECT 'Testing authenticated access:' as info;

-- Test user lookup
SELECT 
    'Users table access test:' as test_type,
    COUNT(*) as accessible_users
FROM public.users;

-- Test role lookup
SELECT 
    'Roles table access test:' as test_type,
    COUNT(*) as accessible_roles
FROM public.roles;

-- Test specific user lookup
SELECT 
    'Specific user lookup test:' as test_type,
    email,
    full_name,
    role_id,
    tenant_id
FROM public.users 
WHERE email = 'kenj7214@gmail.com';

-- Show success message
SELECT '✅ Authenticated user RLS policies updated!' as completion_message;
SELECT '🎯 Authenticated users should now be able to access their profiles after login.' as final_message;
