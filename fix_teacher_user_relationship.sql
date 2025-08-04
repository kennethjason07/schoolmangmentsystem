-- Fix teacher-user relationship setup
-- Run this SQL in your Supabase SQL editor

-- 1. Check current teacher and user data
SELECT 
    'Teachers without linked users' as status,
    COUNT(*) as count
FROM teachers t
LEFT JOIN users u ON u.linked_teacher_id = t.id
WHERE u.id IS NULL;

SELECT 
    'Users with teacher role but no linked_teacher_id' as status,
    COUNT(*) as count
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.role_name = 'teacher' AND u.linked_teacher_id IS NULL;

-- 2. Show current teacher-user relationships
SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_full_name,
    r.role_name
FROM teachers t
LEFT JOIN users u ON u.linked_teacher_id = t.id
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY t.name;

-- 3. Show users with teacher role
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.linked_teacher_id,
    r.role_name,
    t.name as linked_teacher_name
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN teachers t ON u.linked_teacher_id = t.id
WHERE r.role_name = 'teacher'
ORDER BY u.email;

-- 4. Fix missing relationships (if needed)
-- This will try to match teachers and users by name/email

-- First, let's see if we can match by name
SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    u.id as user_id,
    u.email as user_email,
    u.full_name as user_full_name
FROM teachers t
JOIN users u ON LOWER(t.name) = LOWER(u.full_name)
JOIN roles r ON u.role_id = r.id
WHERE r.role_name = 'teacher' 
AND u.linked_teacher_id IS NULL;

-- 5. Auto-fix relationships where names match (uncomment if needed)
/*
UPDATE users 
SET linked_teacher_id = (
    SELECT t.id 
    FROM teachers t 
    WHERE LOWER(t.name) = LOWER(users.full_name)
    LIMIT 1
)
WHERE id IN (
    SELECT u.id
    FROM users u
    JOIN roles r ON u.role_id = r.id
    JOIN teachers t ON LOWER(t.name) = LOWER(u.full_name)
    WHERE r.role_name = 'teacher' 
    AND u.linked_teacher_id IS NULL
);
*/

-- 6. Create sample teacher-user relationship if none exist
-- (Uncomment if you need to create test data)

/*
DO $$
DECLARE
    teacher_role_id integer;
    sample_teacher_id uuid;
    sample_user_id uuid;
BEGIN
    -- Get teacher role ID
    SELECT id INTO teacher_role_id FROM roles WHERE role_name = 'teacher' LIMIT 1;
    
    IF teacher_role_id IS NULL THEN
        -- Create teacher role if it doesn't exist
        INSERT INTO roles (role_name) VALUES ('teacher') RETURNING id INTO teacher_role_id;
    END IF;
    
    -- Check if we have any teachers
    SELECT id INTO sample_teacher_id FROM teachers LIMIT 1;
    
    IF sample_teacher_id IS NULL THEN
        -- Create a sample teacher
        INSERT INTO teachers (name, qualification, age, salary_type, salary_amount, address)
        VALUES ('John Doe', 'M.Ed', 35, 'monthly', 50000, 'Sample Address')
        RETURNING id INTO sample_teacher_id;
        
        RAISE NOTICE 'Created sample teacher with ID: %', sample_teacher_id;
    END IF;
    
    -- Check if we have a user for this teacher
    SELECT id INTO sample_user_id 
    FROM users 
    WHERE linked_teacher_id = sample_teacher_id 
    LIMIT 1;
    
    IF sample_user_id IS NULL THEN
        -- Create a sample user account for the teacher
        INSERT INTO users (email, full_name, role_id, linked_teacher_id, password)
        VALUES (
            'teacher@school.com',
            (SELECT name FROM teachers WHERE id = sample_teacher_id),
            teacher_role_id,
            sample_teacher_id,
            '$2a$10$example.hash.for.password123'  -- This should be properly hashed
        )
        RETURNING id INTO sample_user_id;
        
        RAISE NOTICE 'Created sample user with ID: % linked to teacher: %', sample_user_id, sample_teacher_id;
    END IF;
    
END $$;
*/

-- 7. Verify the relationships after fixes
SELECT 
    'Fixed relationships' as status,
    COUNT(*) as count
FROM users u
JOIN roles r ON u.role_id = r.id
JOIN teachers t ON u.linked_teacher_id = t.id
WHERE r.role_name = 'teacher';

-- 8. Show any remaining issues
SELECT 
    'Users with teacher role but still no linked_teacher_id' as issue,
    u.id,
    u.email,
    u.full_name
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.role_name = 'teacher' AND u.linked_teacher_id IS NULL;
