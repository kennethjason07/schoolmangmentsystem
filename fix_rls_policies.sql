-- Fix RLS Policies for Login Access
-- This script will ensure the anon role can read from the roles table for login validation
-- Run this in your Supabase SQL Editor

-- ========================================
-- STEP 1: Check current RLS status
-- ========================================
SELECT 'Current RLS status for roles table:' as info;
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('roles', 'tenants');

-- Check existing policies
SELECT 'Existing policies for roles table:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'roles';

-- ========================================
-- STEP 2: Create policy to allow anon users to read roles
-- ========================================

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Allow anon to read roles for login" ON public.roles;

-- Create new policy that allows anon users to read roles
CREATE POLICY "Allow anon to read roles for login" 
ON public.roles 
FOR SELECT 
TO anon 
USING (true);

-- Also ensure authenticated users can read roles
DROP POLICY IF EXISTS "Allow authenticated to read roles" ON public.roles;
CREATE POLICY "Allow authenticated to read roles" 
ON public.roles 
FOR SELECT 
TO authenticated 
USING (true);

-- ========================================
-- STEP 3: Create policy for tenants table (if needed)
-- ========================================

-- Check if tenants table has restrictive RLS
DROP POLICY IF EXISTS "Allow anon to read tenants" ON public.tenants;
CREATE POLICY "Allow anon to read tenants" 
ON public.tenants 
FOR SELECT 
TO anon 
USING (true);

DROP POLICY IF EXISTS "Allow authenticated to read tenants" ON public.tenants;
CREATE POLICY "Allow authenticated to read tenants" 
ON public.tenants 
FOR SELECT 
TO authenticated 
USING (true);

-- ========================================
-- STEP 4: Verify the policies are working
-- ========================================
SELECT 'Updated policies for roles table:' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('roles', 'tenants')
ORDER BY tablename, policyname;

-- Test query that should work now
SELECT 'Test query - roles should be visible:' as info;
SELECT id, role_name, tenant_id FROM public.roles ORDER BY id;

-- Show success message
SELECT '✅ RLS policies updated! The anon user can now read roles for login validation.' as completion_message;
