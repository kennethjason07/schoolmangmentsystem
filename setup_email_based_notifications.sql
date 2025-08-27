-- Simple Email-Based Parent Notification Setup
-- This script ensures parents have emails and matching user accounts

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
-- Update parents to have email addresses if they don't
UPDATE parents SET email = 'parent.' || LOWER(name) || '@example.com' 
WHERE email IS NULL OR email = '';

-- Step 3: Create user accounts for parents based on their emails
DO $$
DECLARE
    parent_record RECORD;
    existing_user_count INTEGER;
BEGIN
    -- Create user accounts for all parents who don't have one
    FOR parent_record IN 
        SELECT DISTINCT p.id, p.name, p.email
        FROM parents p 
        WHERE p.email IS NOT NULL AND p.email != ''
    LOOP
        -- Check if user already exists
        SELECT COUNT(*) INTO existing_user_count
        FROM users u 
        WHERE u.email = parent_record.email AND u.role_id = 3;
        
        -- Create user account if it doesn't exist
        IF existing_user_count = 0 THEN
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
            
            RAISE NOTICE 'Created user account for parent: % (Email: %)', 
                parent_record.name, parent_record.email;
        ELSE
            RAISE NOTICE 'User account already exists for: % (Email: %)', 
                parent_record.name, parent_record.email;
        END IF;
    END LOOP;
END $$;

-- Step 4: Test the notification function
-- Replace with your actual class ID
DO $$
DECLARE
    test_class_id UUID := '37b82e22-ff67-45f7-9df4-1e0201376fb9';
    parent_record RECORD;
    parent_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Testing parent lookup for class: %', test_class_id;
    
    FOR parent_record IN 
        SELECT parent_user_id, parent_name, parent_email
        FROM get_class_parent_ids(test_class_id)
    LOOP
        parent_count := parent_count + 1;
        RAISE NOTICE 'Found parent: % (Email: %, User ID: %)', 
            parent_record.parent_name, 
            parent_record.parent_email, 
            parent_record.parent_user_id;
    END LOOP;
    
    RAISE NOTICE 'Total parents found for class: %', parent_count;
END $$;

-- Step 5: Show final summary
SELECT 'EMAIL MATCHING SUMMARY' as summary_type;

-- Show parents with emails
SELECT 'PARENTS WITH EMAILS' as type, COUNT(*) as count
FROM parents WHERE email IS NOT NULL AND email != '';

-- Show parent users 
SELECT 'PARENT USER ACCOUNTS' as type, COUNT(*) as count  
FROM users WHERE role_id = 3;

-- Show parent-user email matches
SELECT 'EMAIL MATCHES (PARENTS & USERS)' as type, COUNT(*) as count
FROM parents p 
JOIN users u ON p.email = u.email AND u.role_id = 3
WHERE p.email IS NOT NULL AND p.email != '';

-- Show parents found for your specific class
SELECT 'PARENTS FOR TEST CLASS' as type, COUNT(*) as count
FROM get_class_parent_ids('37b82e22-ff67-45f7-9df4-1e0201376fb9');
