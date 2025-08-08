-- Fix Users Table Row Level Security Policies
-- This script ensures users can update their own profiles

-- First, check if RLS is enabled on users table and disable it temporarily
-- to avoid conflicts while setting up policies
DO $$
BEGIN
    -- Check if RLS is enabled
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'users' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled on users table';
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
        DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
        DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
        DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
        
        RAISE NOTICE 'Dropped existing policies';
    ELSE
        RAISE NOTICE 'RLS is not enabled on users table, enabling it now';
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create comprehensive RLS policies for users table

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT 
    TO authenticated
    USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Policy 3: Allow admins to view all users (optional - for admin functionality)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() 
            AND r.role_name = 'admin'
        )
    );

-- Policy 4: Allow admins to update all users (optional - for admin functionality)
CREATE POLICY "Admins can update all users" ON public.users
    FOR UPDATE 
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.roles r ON u.role_id = r.id
            WHERE u.id = auth.uid() 
            AND r.role_name = 'admin'
        )
    );

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users' 
AND schemaname = 'public';

-- Test query to verify a user can see their own profile
-- (This will only work when executed by an authenticated user)
-- SELECT id, email, full_name, phone FROM public.users WHERE id = auth.uid();

RAISE NOTICE 'Users table RLS policies have been set up successfully!';
RAISE NOTICE 'Users can now:';
RAISE NOTICE '1. View their own profile';
RAISE NOTICE '2. Update their own profile';
RAISE NOTICE '3. Admins can view and update all users';
