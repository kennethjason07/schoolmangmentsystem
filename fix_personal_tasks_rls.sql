-- Fix personal_tasks RLS policies for insertion issues
-- Run this in Supabase SQL Editor

-- Step 1: Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS is ENABLED (might be blocking inserts)'
        ELSE '✅ RLS is DISABLED'
    END as status
FROM pg_tables 
WHERE tablename = 'personal_tasks' 
  AND schemaname = 'public';

-- Step 2: Check existing policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'personal_tasks' 
  AND schemaname = 'public';

-- Step 3: Check current user's info for debugging
SELECT 
    auth.uid() as current_user_id,
    auth.jwt() ->> 'tenant_id' as tenant_id_from_jwt,
    auth.jwt() ->> 'role' as role_from_jwt;

-- Step 4: Check user's actual data from users table
SELECT 
    id,
    email,
    tenant_id,
    role_id,
    full_name
FROM public.users 
WHERE id = auth.uid();

-- Step 5: The main fix - Drop restrictive policy and create more permissive one
-- This policy was likely causing the 42501 error
DROP POLICY IF EXISTS "personal_tasks_tenant_isolation" ON public.personal_tasks;

-- Create a more permissive policy that focuses on user ownership
-- rather than strict tenant isolation
CREATE POLICY "personal_tasks_user_owned" ON public.personal_tasks
FOR ALL TO authenticated
USING (
    -- User can access their own tasks
    user_id = auth.uid()
)
WITH CHECK (
    -- User can only create/modify tasks they own
    user_id = auth.uid()
);

-- Step 6: Alternative - Create separate policies for different operations (more granular)
-- Uncomment these if you want more control:

/*
-- Drop the policy we just created to use these instead
DROP POLICY IF EXISTS "personal_tasks_user_owned" ON public.personal_tasks;

-- SELECT: Users can view their own tasks
CREATE POLICY "personal_tasks_select" ON public.personal_tasks
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can create their own tasks 
CREATE POLICY "personal_tasks_insert" ON public.personal_tasks
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own tasks
CREATE POLICY "personal_tasks_update" ON public.personal_tasks
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own tasks
CREATE POLICY "personal_tasks_delete" ON public.personal_tasks
FOR DELETE TO authenticated
USING (user_id = auth.uid());
*/

-- Step 7: Verify the new policy is in place
SELECT 
    'New Policy:' as info,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'personal_tasks' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Step 8: Test message
SELECT 
    '✅ Personal tasks RLS policy updated!' as status,
    'Try adding tasks now - the 42501 error should be resolved' as message;

-- EXPLANATION OF THE FIX:
-- The original policy "personal_tasks_tenant_isolation" used:
-- FOR ALL USING (tenant_id::text = auth.jwt() ->> 'tenant_id')
-- 
-- This failed because:
-- 1. JWT might not contain 'tenant_id' claim
-- 2. String comparison between tenant_id::text and JWT claim was failing
-- 3. No fallback mechanism
--
-- The new policy "personal_tasks_user_owned" uses:
-- user_id = auth.uid()
-- 
-- This works because:
-- 1. auth.uid() always returns the authenticated user's ID
-- 2. No dependency on JWT claims
-- 3. Simpler and more reliable
-- 4. Still provides security by ensuring users can only access their own tasks
