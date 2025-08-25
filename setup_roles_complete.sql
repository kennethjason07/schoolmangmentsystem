-- Complete setup script for roles table
-- Run this in your Supabase SQL Editor

-- First, check if the roles table exists and what's in it
SELECT 'Current roles table content:' as info;
SELECT * FROM roles ORDER BY id;

-- Clear any existing conflicting data (optional - only if you have issues)
-- TRUNCATE TABLE roles RESTART IDENTITY CASCADE;

-- Insert the basic roles that your app expects
-- Using INSERT with ON CONFLICT to handle duplicates safely
INSERT INTO roles (id, role_name) VALUES 
  (1, 'Admin'),
  (2, 'Teacher'), 
  (3, 'Parent'),
  (4, 'Student')
ON CONFLICT (id) DO UPDATE SET role_name = EXCLUDED.role_name;

-- If the above doesn't work (some DBs don't allow explicit ID insertion), use this alternative:
-- INSERT INTO roles (role_name) VALUES 
--   ('Admin'),
--   ('Teacher'), 
--   ('Parent'),
--   ('Student')
-- ON CONFLICT (role_name) DO NOTHING;

-- Verify the roles were created correctly
SELECT 'Roles after setup:' as info;
SELECT id, role_name FROM roles ORDER BY id;

-- Show count to confirm all 4 roles exist
SELECT 'Total roles count:' as info, COUNT(*) as total_roles FROM roles;

-- Test the specific query that your app uses
SELECT 'Testing role lookup (should return id=1):' as info;
SELECT id FROM roles WHERE role_name = 'Admin' LIMIT 1;

SELECT 'Testing role lookup (should return id=2):' as info;  
SELECT id FROM roles WHERE role_name = 'Teacher' LIMIT 1;

SELECT 'Testing role lookup (should return id=3):' as info;
SELECT id FROM roles WHERE role_name = 'Parent' LIMIT 1;

SELECT 'Testing role lookup (should return id=4):' as info;
SELECT id FROM roles WHERE role_name = 'Student' LIMIT 1;
