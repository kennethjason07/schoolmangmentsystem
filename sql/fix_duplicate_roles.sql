-- Fix Duplicate Roles in Database
-- This script will clean up the roles table to have only the correct 4 roles
-- IMPORTANT: Run this step by step in your Supabase SQL editor

-- 1. First, check the current state of the roles and users table
SELECT 'ROLES TABLE:' as info;
SELECT id, role_name, tenant_id FROM roles ORDER BY id;

SELECT 'USERS BY ROLE_ID:' as info;
SELECT role_id, COUNT(*) as user_count FROM users GROUP BY role_id ORDER BY role_id;

-- 2. FIRST: Map existing role_ids in users table to the correct standard roles
-- We need to do this BEFORE deleting the duplicate roles
-- Based on the roles we saw: 5=teacher, 6=admin, 7=student, 8=parent
-- Map them to the standard roles: 1=Admin, 2=Teacher, 3=Parent, 4=Student

-- Map role_id 5 (teacher) to role_id 2 (Teacher)
UPDATE users SET role_id = 2 WHERE role_id = 5;

-- Map role_id 6 (admin) to role_id 1 (Admin)
UPDATE users SET role_id = 1 WHERE role_id = 6;

-- Map role_id 7 (student) to role_id 4 (Student)
UPDATE users SET role_id = 4 WHERE role_id = 7;

-- Map role_id 8 (parent) to role_id 3 (Parent)
UPDATE users SET role_id = 3 WHERE role_id = 8;

-- Handle any NULL or other invalid role_ids by setting them to Admin (1)
UPDATE users SET role_id = 1 WHERE role_id IS NULL OR role_id NOT IN (1, 2, 3, 4);

-- 3. Verify users have been mapped correctly
SELECT 'USERS AFTER MAPPING:' as info;
SELECT role_id, COUNT(*) as user_count FROM users GROUP BY role_id ORDER BY role_id;

-- 4. NOW: Delete all duplicate/incorrect roles (keep only the first 4)
DELETE FROM roles WHERE id > 4;

-- 5. Update the first 4 roles to have the correct names and tenant_id
UPDATE roles SET 
  role_name = 'Admin',
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = 1;

UPDATE roles SET 
  role_name = 'Teacher',
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = 2;

UPDATE roles SET 
  role_name = 'Parent',
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = 3;

UPDATE roles SET 
  role_name = 'Student',
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = 4;

-- 6. Verify the roles are now correct
SELECT 'FINAL ROLES TABLE:' as info;
SELECT id, role_name, tenant_id FROM roles ORDER BY id;

-- 7. Verify users have valid role_ids
SELECT 'FINAL USERS BY ROLE:' as info;
SELECT role_id, COUNT(*) as count FROM users GROUP BY role_id ORDER BY role_id;

-- 8. Check that all users have the correct tenant_id
SELECT 'TENANT CHECK:' as info;
SELECT COUNT(*) as total_users, 
       COUNT(CASE WHEN tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' THEN 1 END) as users_with_correct_tenant
FROM users;
