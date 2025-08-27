-- Simple test: Create notification and recipient directly

-- Step 1: Create a test parent user if needed
DO $$
DECLARE
    parent_user_id UUID;
BEGIN
    -- Check if parent user exists
    SELECT id INTO parent_user_id
    FROM users 
    WHERE email = 'Arshadpatel1431@gmail.com' AND role_id = 3;
    
    IF parent_user_id IS NULL THEN
        -- Create parent user
        INSERT INTO users (
            full_name,
            email,
            password_hash,
            role_id,
            created_at,
            updated_at
        ) VALUES (
            'Justus Parent',
            'Arshadpatel1431@gmail.com',
            '$2b$10$dummy.hash.for.testing.only',
            3,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        ) RETURNING id INTO parent_user_id;
        
        RAISE NOTICE 'Created parent user with ID: %', parent_user_id;
    ELSE
        RAISE NOTICE 'Parent user already exists with ID: %', parent_user_id;
    END IF;
END $$;

-- Step 2: Create a test notification directly
DO $$
DECLARE
    notification_id UUID;
    parent_user_id UUID;
BEGIN
    -- Get parent user ID
    SELECT id INTO parent_user_id
    FROM users 
    WHERE email = 'Arshadpatel1431@gmail.com' AND role_id = 3;
    
    IF parent_user_id IS NOT NULL THEN
        -- Create notification
        INSERT INTO notifications (
            type,
            message,
            delivery_mode,
            created_at
        ) VALUES (
            'GRADE_ENTERED',
            'Test: New marks have been entered for Mathematics - FA1 by Teacher. Check your child''s progress in the marks section.',
            'InApp',
            CURRENT_TIMESTAMP
        ) RETURNING id INTO notification_id;
        
        -- Create recipient
        INSERT INTO notification_recipients (
            notification_id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at,
            is_read
        ) VALUES (
            notification_id,
            parent_user_id,
            'Parent',
            'Sent',
            CURRENT_TIMESTAMP,
            false
        );
        
        RAISE NOTICE 'Created test notification % for parent %', notification_id, parent_user_id;
        
        -- Verify creation
        SELECT 'TEST NOTIFICATION CREATED' as result,
               n.id,
               n.message,
               nr.recipient_id,
               u.full_name as recipient_name
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        JOIN users u ON nr.recipient_id = u.id
        WHERE n.id = notification_id;
        
    ELSE
        RAISE NOTICE 'Parent user not found!';
    END IF;
END $$;
