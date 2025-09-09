-- IMMEDIATE FIX for role assignment issue

-- Step 1: Check what the actual role IDs are in your database
SELECT 'Current Role IDs' as info_type, id, role_name 
FROM roles 
ORDER BY id;

-- Step 2: Fix the parent user who got assigned wrong role
UPDATE users 
SET role_id = (
    SELECT id FROM roles 
    WHERE role_name ILIKE 'parent' 
    LIMIT 1
)
WHERE email = 'arshadpatel1431@gmail.com';

-- Step 3: Verify the fix
SELECT 'Fixed User' as info_type,
       u.email,
       u.role_id,
       r.role_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'arshadpatel1431@gmail.com';
