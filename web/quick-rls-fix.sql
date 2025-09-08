-- QUICK FIX: Temporarily disable RLS for testing
-- Run this in Supabase SQL Editor for immediate testing

-- Disable RLS on users table temporarily
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Optional: Also disable on tenants table if needed
-- ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- This allows direct inserts to work during development/testing
-- IMPORTANT: Re-enable RLS for production!
