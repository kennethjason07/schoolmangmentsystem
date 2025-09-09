-- SQL Debugging Queries for Parent Login Issue
-- Run these in your database to check parent user configuration

-- 1. Check if parent user exists and what role_id they have
-- Replace 'parent@example.com' with the actual parent email you're testing with
SELECT 
    id,
    email,
    role_id,
    full_name,
    tenant_id,
    created_at
FROM users 
WHERE email ILIKE '%parent%' OR role_id = 3;

-- 2. Check the roles table structure and content
SELECT 
    id,
    role_name,
    created_at
FROM roles 
ORDER BY id;

-- 3. Check for any users with null or invalid role_id
SELECT 
    id,
    email,
    role_id,
    full_name,
    CASE 
        WHEN role_id IS NULL THEN 'NULL role_id'
        WHEN role_id NOT IN (1,2,3,4) THEN 'Invalid role_id'
        ELSE 'Valid role_id'
    END as role_status
FROM users
WHERE role_id IS NULL OR role_id NOT IN (1,2,3,4);

-- 4. Check all users and their roles (to understand the data structure)
SELECT 
    u.id,
    u.email,
    u.role_id,
    r.role_name,
    u.full_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY u.role_id, u.email;

-- 5. Specific check for the parent user you're testing with
-- REPLACE 'your-parent-email@example.com' with the actual email
SELECT 
    u.id as user_id,
    u.email,
    u.role_id,
    r.role_name,
    u.full_name,
    u.tenant_id,
    CASE 
        WHEN u.role_id = 3 THEN '✅ Correct Parent Role'
        WHEN u.role_id = 1 THEN '❌ Has Admin Role (should be 3)'
        WHEN u.role_id IS NULL THEN '❌ NULL Role ID'
        ELSE '❌ Other Role: ' || u.role_id::text
    END as diagnosis
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'YOUR_PARENT_EMAIL_HERE';

-- 6. Check if there are multiple users with the same email (edge case)
SELECT 
    email,
    COUNT(*) as user_count,
    array_agg(role_id) as all_role_ids,
    array_agg(id) as all_user_ids
FROM users
GROUP BY email
HAVING COUNT(*) > 1;

-- 7. Check the structure of both tables to ensure they're set up correctly
\d users;
\d roles;
