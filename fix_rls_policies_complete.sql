-- Complete RLS Policies Fix for Login System
-- This script fixes RLS policies for both roles AND users tables
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: Check current RLS status
-- ========================================
SELECT 'Current RLS status:' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roles', 'tenants', 'users');

-- Check existing policies
SELECT 'Existing policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('roles', 'tenants', 'users')
ORDER BY tablename, policyname;

-- ========================================
-- STEP 2: Create policies for ROLES table
-- ========================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anon to read roles for login" ON public.roles;
DROP POLICY IF EXISTS "Allow authenticated to read roles" ON public.roles;

-- Create new policies that allow anon and authenticated users to read roles
CREATE POLICY "Allow anon to read roles for login" 
ON public.roles 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow authenticated to read roles" 
ON public.roles 
FOR SELECT 
TO authenticated 
USING (true);

-- ========================================
-- STEP 3: Create policies for USERS table
-- ========================================

-- Drop existing user policies if they exist
DROP POLICY IF EXISTS "Allow anon to read users for login" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated to read users" ON public.users;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.users;

-- Create policy that allows anon users to read users table (needed for login)
CREATE POLICY "Allow anon to read users for login" 
ON public.users 
FOR SELECT 
TO anon 
USING (true);

-- Create policy that allows authenticated users to read users
CREATE POLICY "Allow authenticated to read users" 
ON public.users 
FOR SELECT 
TO authenticated 
USING (true);

-- Also allow authenticated users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ========================================
-- STEP 4: Create policies for TENANTS table
-- ========================================

-- Drop existing tenant policies if they exist
DROP POLICY IF EXISTS "Allow anon to read tenants" ON public.tenants;
DROP POLICY IF EXISTS "Allow authenticated to read tenants" ON public.tenants;

-- Create policies for tenants table
CREATE POLICY "Allow anon to read tenants" 
ON public.tenants 
FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow authenticated to read tenants" 
ON public.tenants 
FOR SELECT 
TO authenticated 
USING (true);

-- ========================================
-- STEP 5: Verify the policies are working
-- ========================================
SELECT 'Updated policies:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('roles', 'tenants', 'users')
ORDER BY tablename, policyname;

-- Test queries that should work now
SELECT 'Test query - roles should be visible:' as info;
SELECT id, role_name, tenant_id FROM public.roles ORDER BY id;

SELECT 'Test query - user should be visible:' as info;
SELECT id, email, full_name, role_id, tenant_id FROM public.users 
WHERE email = 'kenj7214@gmail.com';

SELECT 'Test query - tenants should be visible:' as info;
SELECT id, name, subdomain FROM public.tenants ORDER BY created_at;

-- Show success message
SELECT '✅ RLS policies updated! The anon user can now read roles, users, and tenants for login.' as completion_message;
SELECT '🎉 Your login should work completely now!' as final_message;
