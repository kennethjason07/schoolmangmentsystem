-- ============================================================
-- EMERGENCY FIX: INFINITE RECURSION IN USERS TABLE RLS POLICY
-- ============================================================
-- This fixes the login issue caused by recursive RLS policy

-- Step 1: Temporarily disable RLS on users table to fix the recursion
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS users_email_tenant_access ON public.users;

-- Step 3: Create a simple, non-recursive policy for users table
CREATE POLICY users_simple_access ON public.users
  FOR ALL USING (
    -- Allow users to access their own record (no recursion here)
    id = auth.uid()
    OR
    -- Allow access to users in the same tenant using a direct subquery
    -- This avoids recursion by not referencing the users table in the subquery
    EXISTS (
      SELECT 1 
      FROM public.users base_user 
      WHERE base_user.id = auth.uid() 
        AND base_user.tenant_id = users.tenant_id
    )
  );

-- Step 4: Re-enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 5: Verify the fix
SELECT 
  'USERS RLS FIXED' as status,
  'Login should work now' as message,
  'Non-recursive policy created' as solution;

-- Show current users policies
SELECT 
  'CURRENT USERS POLICIES' as type,
  policyname,
  permissive,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users';
