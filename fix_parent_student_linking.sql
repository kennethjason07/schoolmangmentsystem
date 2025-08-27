-- Fix Parent-Student Linking in Users Table

-- Step 1: Update existing parent users to link them to their students
UPDATE users 
SET linked_parent_of = (
    -- Find the student ID this parent should be linked to
    SELECT s.id 
    FROM students s
    JOIN parents p ON (s.parent_id = p.id OR p.student_id = s.id)
    WHERE p.email = users.email
    AND users.role_id = 3
    LIMIT 1
)
WHERE role_id = 3 
AND linked_parent_of IS NULL
AND email IN (
    SELECT DISTINCT p.email 
    FROM parents p 
    WHERE p.email IS NOT NULL
);

-- Step 2: Show results of the linking
SELECT 'PARENT USER LINKING RESULTS' as info;

SELECT 
    u.full_name as parent_name,
    u.email as parent_email,
    s.name as linked_student_name,
    s.id as linked_student_id,
    CASE 
        WHEN u.linked_parent_of IS NOT NULL THEN 'LINKED'
        ELSE 'NOT LINKED'
    END as link_status
FROM users u
LEFT JOIN students s ON u.linked_parent_of = s.id
WHERE u.role_id = 3
ORDER BY u.full_name;

-- Step 3: Update the notification function to use the linked_parent_of field
CREATE OR REPLACE FUNCTION get_class_parent_ids(p_class_id UUID)
RETURNS TABLE(parent_user_id UUID, parent_name TEXT, parent_email TEXT) AS $$
BEGIN
    -- Find parent users who are linked to students in this class
    RETURN QUERY
    SELECT DISTINCT 
        u.id as parent_user_id,
        u.full_name as parent_name,
        u.email as parent_email
    FROM users u
    JOIN students s ON u.linked_parent_of = s.id
    WHERE s.class_id = p_class_id
    AND u.role_id = 3
    AND u.linked_parent_of IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Test the updated function
DO $$
DECLARE
    test_class_id UUID := '37b82e22-ff67-45f7-9df4-1e0201376fb9';
    parent_record RECORD;
    parent_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== TESTING UPDATED PARENT LOOKUP ===';
    
    FOR parent_record IN 
        SELECT parent_user_id, parent_name, parent_email
        FROM get_class_parent_ids(test_class_id)
    LOOP
        parent_count := parent_count + 1;
        RAISE NOTICE 'Found linked parent %: % (Email: %)', 
            parent_count,
            parent_record.parent_name, 
            parent_record.parent_email;
    END LOOP;
    
    RAISE NOTICE '=== RESULT: % linked parents found ===', parent_count;
END $$;

-- Step 5: Show summary
SELECT 'SUMMARY' as info;

SELECT 'Total Parent Users' as category, COUNT(*) as count
FROM users WHERE role_id = 3;

SELECT 'Linked Parent Users' as category, COUNT(*) as count
FROM users WHERE role_id = 3 AND linked_parent_of IS NOT NULL;

SELECT 'Parents for Test Class' as category, COUNT(*) as count
FROM get_class_parent_ids('37b82e22-ff67-45f7-9df4-1e0201376fb9');
