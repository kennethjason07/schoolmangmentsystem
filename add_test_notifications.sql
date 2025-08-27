-- Add test notifications for debugging
-- Run this in your Supabase SQL editor

-- First check current notifications and users
SELECT 'Current notifications:' as info;
SELECT id, type, message, delivery_status, sent_by FROM notifications LIMIT 5;

SELECT 'Admin users:' as info;
SELECT id, full_name, role_id FROM users WHERE role_id = 1 LIMIT 3;

-- Get first admin user ID for test notifications
DO $$
DECLARE
    admin_user_id uuid;
    notification_types text[] := ARRAY['General', 'Fee Reminder', 'Urgent', 'Event'];
    i int;
BEGIN
    -- Get first admin user
    SELECT id INTO admin_user_id FROM users WHERE role_id = 1 LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'No admin user found - creating a dummy admin user';
        -- Create a dummy admin user for testing
        INSERT INTO users (full_name, email, role_id, password_hash)
        VALUES ('Test Admin', 'admin@test.com', 1, 'dummy_hash')
        RETURNING id INTO admin_user_id;
    END IF;
    
    RAISE NOTICE 'Using admin user ID: %', admin_user_id;
    
    -- Delete existing test notifications first
    DELETE FROM notifications WHERE message LIKE 'TEST:%';
    
    -- Add test notifications for each type
    FOR i IN 1..4 LOOP
        INSERT INTO notifications (
            type,
            message,
            delivery_mode,
            delivery_status,
            sent_by,
            created_at
        ) VALUES (
            notification_types[i]::notification_type_enum,
            'TEST: ' || notification_types[i] || ' notification message #' || i || ' - This is a test notification to verify the system is working.',
            'InApp',
            CASE WHEN i % 2 = 0 THEN 'Sent' ELSE 'Pending' END,
            admin_user_id,
            CURRENT_TIMESTAMP - (i || ' hours')::interval
        );
    END LOOP;
    
    RAISE NOTICE 'Added % test notifications', array_length(notification_types, 1);
END $$;

-- Verify the notifications were added
SELECT 'New test notifications:' as info;
SELECT 
    id,
    type,
    message,
    delivery_status,
    sent_by,
    created_at
FROM notifications 
WHERE message LIKE 'TEST:%'
ORDER BY created_at DESC;
