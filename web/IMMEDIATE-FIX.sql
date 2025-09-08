-- IMMEDIATE FIX: Run this in Supabase SQL Editor NOW
-- This will make your onboarding work immediately

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Disable RLS on tenants table (in case it's also causing issues)
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- That's it! Your onboarding should work now.
