-- ============================================
-- RE-ENABLE RLS ON SPECIFIC TABLES
-- Copy and paste this into Supabase SQL Editor
-- ============================================

-- Re-enable RLS on the tables you disabled
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create basic policies to allow anonymous tenant creation (for onboarding)
-- This ensures your onboarding form still works

-- Policy for tenants table
DROP POLICY IF EXISTS "Allow anon to create tenants" ON tenants;
CREATE POLICY "Allow anon to create tenants" ON tenants
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Policy for roles table  
DROP POLICY IF EXISTS "Allow anon to create roles" ON roles;
CREATE POLICY "Allow anon to create roles" ON roles
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Policy for school_details table
DROP POLICY IF EXISTS "Allow anon to create school details" ON school_details;
CREATE POLICY "Allow anon to create school details" ON school_details
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Policy for users table
DROP POLICY IF EXISTS "Allow anon to create users" ON users;
CREATE POLICY "Allow anon to create users" ON users
    FOR INSERT 
    TO anon 
    WITH CHECK (true);

-- Optional: Add policies for authenticated users to read their own data
CREATE POLICY "Users can read their own tenant" ON tenants
    FOR SELECT 
    TO authenticated
    USING (id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Users can read roles in their tenant" ON roles
    FOR SELECT 
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Users can read their school details" ON school_details
    FOR SELECT 
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

CREATE POLICY "Users can read their own profile" ON users
    FOR SELECT 
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can read users in their tenant" ON users
    FOR SELECT 
    TO authenticated
    USING (tenant_id::text = (auth.jwt() -> 'user_metadata' ->> 'tenant_id'));

-- Done! RLS is now re-enabled with policies that allow onboarding to work
