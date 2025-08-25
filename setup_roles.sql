-- Setup basic roles for the school management system
-- Run this SQL script in your Supabase SQL editor

-- First, check if roles already exist
SELECT 'Current roles:' as info;
SELECT * FROM roles ORDER BY id;

-- Insert the basic roles if they don't exist
INSERT INTO roles (id, role_name) VALUES 
  (1, 'Admin'),
  (2, 'Teacher'), 
  (3, 'Parent'),
  (4, 'Student')
ON CONFLICT (id) DO UPDATE SET 
  role_name = EXCLUDED.role_name;

-- Alternative insert in case the above doesn't work with explicit IDs
-- INSERT INTO roles (role_name) VALUES 
--   ('Admin'),
--   ('Teacher'), 
--   ('Parent'),
--   ('Student')
-- ON CONFLICT (role_name) DO NOTHING;

-- Verify the roles were created
SELECT 'Roles after setup:' as info;
SELECT * FROM roles ORDER BY id;

-- Show role counts
SELECT 
  'Total roles created:' as info,
  COUNT(*) as count 
FROM roles;
