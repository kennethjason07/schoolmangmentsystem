-- FIX ROLE ASSIGNMENTS - Check and correct role IDs
-- The parent account was created with wrong role_id

-- Step 1: Check current role assignments
SELECT 
    'Current Roles' as info_type,
    id,
    role_name,
    tenant_id
FROM roles 
ORDER BY id;

-- Step 2: Check the problematic user account
SELECT 
    'Problem User' as info_type,
    u.id,
    u.email,
    u.full_name,
    u.role_id,
    r.role_name as current_role_name,
    u.linked_parent_of,
    u.linked_student_id
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'arshadpatel1431@gmail.com';

-- Step 3: Find the correct parent role ID
SELECT 
    'Parent Role ID' as info_type,
    id,
    role_name
FROM roles 
WHERE role_name = 'parent' OR role_name = 'Parent';

-- Step 4: Find the correct student role ID  
SELECT 
    'Student Role ID' as info_type,
    id,
    role_name
FROM roles 
WHERE role_name = 'student' OR role_name = 'Student';

-- Step 5: Fix the user's role - Update to correct parent role
-- Replace PARENT_ROLE_ID with the actual ID from Step 3
UPDATE users 
SET role_id = (
    SELECT id FROM roles 
    WHERE role_name ILIKE 'parent' 
    LIMIT 1
)
WHERE email = 'arshadpatel1431@gmail.com';

-- Step 6: Verify the fix worked
SELECT 
    'After Fix' as info_type,
    u.id,
    u.email,
    u.full_name,
    u.role_id,
    r.role_name as corrected_role_name,
    u.linked_parent_of
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'arshadpatel1431@gmail.com';

-- Step 7: Check if there are other users with wrong roles
SELECT 
    'Users with linked_parent_of but not parent role' as info_type,
    u.email,
    u.full_name,
    u.role_id,
    r.role_name,
    'Should be parent role' as issue
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.linked_parent_of IS NOT NULL 
AND r.role_name != 'parent'
AND r.role_name != 'Parent';

-- Step 8: Clean up any other incorrectly assigned parent users
UPDATE users 
SET role_id = (
    SELECT id FROM roles 
    WHERE role_name ILIKE 'parent' 
    LIMIT 1
)
WHERE linked_parent_of IS NOT NULL 
AND role_id NOT IN (
    SELECT id FROM roles 
    WHERE role_name ILIKE 'parent'
);
