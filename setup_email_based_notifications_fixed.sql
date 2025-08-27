-- Fixed Email-Based Parent Notification Setup (handles existing users)

-- Step 1: Update the notification function with simplified approach
CREATE OR REPLACE FUNCTION get_class_parent_ids(p_class_id UUID)
RETURNS TABLE(parent_user_id UUID, parent_name TEXT, parent_email TEXT) AS $$
BEGIN
    -- Simplified approach: Find parents by matching emails between parents and users tables
    RETURN QUERY
    SELECT DISTINCT 
        u.id as parent_user_id,
        u.full_name as parent_name,
        u.email as parent_email
    FROM students s
    JOIN parents p ON (s.parent_id = p.id OR p.student_id = s.id)
    JOIN users u ON p.email = u.email AND u.role_id = 3
    WHERE s.class_id = p_class_id
    AND p.email IS NOT NULL 
    AND u.email IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Ensure parents have email addresses (add if missing)
-- Update parents to have email addresses if they don't (skip if already have email)
UPDATE parents SET email = 'parent.' || LOWER(REPLACE(name, ' ', '.')) || '@example.com' 
WHERE email IS NULL OR email = '';

-- Step 3: Create user accounts for parents (with duplicate handling)
DO $$
DECLARE
    parent_record RECORD;
    created_count INTEGER := 0;
    existing_count INTEGER := 0;
BEGIN
    -- Create user accounts for all parents who don't have one
    FOR parent_record IN 
        SELECT DISTINCT p.id, p.name, p.email
        FROM parents p 
        WHERE p.email IS NOT NULL AND p.email != ''
    LOOP
        -- Try to create user account, ignore duplicates
        BEGIN
            INSERT INTO users (
                full_name,
                email,
                role_id,
                password,
                created_at
            ) VALUES (
                parent_record.name,
                parent_record.email,
                3, -- Parent role
                'password123', -- Simple password for testing
                CURRENT_TIMESTAMP
            );
            
            created_count := created_count + 1;
            RAISE NOTICE 'Created user account for parent: % (Email: %)', 
                parent_record.name, parent_record.email;
                
        EXCEPTION WHEN unique_violation THEN
            existing_count := existing_count + 1;
            RAISE NOTICE 'User account already exists for: % (Email: %)', 
                parent_record.name, parent_record.email;
        END;
    END LOOP;
    
    RAISE NOTICE 'Summary: % new accounts created, % already existed', created_count, existing_count;
END $$;

-- Step 4: Test the notification function for your class
DO $$
DECLARE
    test_class_id UUID := '37b82e22-ff67-45f7-9df4-1e0201376fb9';
    parent_record RECORD;
    parent_count INTEGER := 0;
BEGIN
    RAISE NOTICE '=== TESTING PARENT LOOKUP FOR CLASS ===';
    RAISE NOTICE 'Class ID: %', test_class_id;
    
    FOR parent_record IN 
        SELECT parent_user_id, parent_name, parent_email
        FROM get_class_parent_ids(test_class_id)
    LOOP
        parent_count := parent_count + 1;
        RAISE NOTICE 'Found parent %: % (Email: %, User ID: %)', 
            parent_count,
            parent_record.parent_name, 
            parent_record.parent_email, 
            parent_record.parent_user_id;
    END LOOP;
    
    RAISE NOTICE '=== RESULT: % parents found for class ===', parent_count;
    
    IF parent_count = 0 THEN
        RAISE NOTICE 'WARNING: No parents found! Check parent-student relationships.';
    ELSE
        RAISE NOTICE 'SUCCESS: Notifications will be sent to % parents when marks are entered.', parent_count;
    END IF;
END $$;

-- Step 5: Show diagnostic information
SELECT '=== DIAGNOSTIC SUMMARY ===' as info;

-- Show total parents
SELECT 'Total Parents' as category, COUNT(*) as count
FROM parents;

-- Show parents with emails
SELECT 'Parents with Emails' as category, COUNT(*) as count
FROM parents WHERE email IS NOT NULL AND email != '';

-- Show total parent user accounts
SELECT 'Parent User Accounts' as category, COUNT(*) as count  
FROM users WHERE role_id = 3;

-- Show successful email matches (parents with user accounts)
SELECT 'Email Matches (Parents↔Users)' as category, COUNT(*) as count
FROM parents p 
JOIN users u ON p.email = u.email AND u.role_id = 3
WHERE p.email IS NOT NULL AND p.email != '';

-- Show parents found for your test class
SELECT 'Parents for Test Class' as category, COUNT(*) as count
FROM get_class_parent_ids('37b82e22-ff67-45f7-9df4-1e0201376fb9');

-- Show specific parent-student relationships for your class
SELECT '=== PARENT-STUDENT RELATIONSHIPS FOR YOUR CLASS ===' as info;

SELECT 
    s.name as student_name,
    p.name as parent_name, 
    p.email as parent_email,
    u.id as user_id,
    CASE WHEN u.id IS NOT NULL THEN 'HAS USER ACCOUNT' ELSE 'NO USER ACCOUNT' END as account_status
FROM students s
LEFT JOIN parents p ON (s.parent_id = p.id OR p.student_id = s.id)
LEFT JOIN users u ON p.email = u.email AND u.role_id = 3
WHERE s.class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
ORDER BY s.name;
