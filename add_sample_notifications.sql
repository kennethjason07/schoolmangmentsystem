-- Add sample notifications that work with current enum
-- Run this SQL in your Supabase SQL editor

-- 1. First, let's see what enum values are currently allowed
SELECT 
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname LIKE '%notification%'
ORDER BY t.typname, e.enumsortorder;

-- 2. Check if we have any existing notifications
SELECT COUNT(*) as notification_count FROM notifications;

-- 3. If the table is empty, let's add some basic notifications
-- We'll use only the enum values that exist

-- First, let's check what the first enum value is
DO $$
DECLARE
    first_enum_value text;
    admin_user_id uuid;
BEGIN
    -- Get the first available enum value for notification type
    SELECT e.enumlabel INTO first_enum_value
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname LIKE '%notification%'
    ORDER BY e.enumsortorder
    LIMIT 1;
    
    -- Get an admin user ID (or create a dummy one)
    SELECT id INTO admin_user_id FROM users LIMIT 1;
    
    -- If we found an enum value and have a user, insert some notifications
    IF first_enum_value IS NOT NULL THEN
        -- Insert sample notifications using the valid enum value
        INSERT INTO notifications (
            type,
            message,
            delivery_mode,
            delivery_status,
            sent_by,
            created_at
        ) VALUES 
        (
            first_enum_value::notification_type_enum,
            'Welcome to the Teacher Dashboard! Your classes and schedule are now available.',
            'InApp',
            'Sent',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '1 day'
        ),
        (
            first_enum_value::notification_type_enum,
            'Please review your assigned classes and subjects for this semester.',
            'InApp',
            'Sent',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '2 hours'
        ),
        (
            first_enum_value::notification_type_enum,
            'Monthly attendance reports are due by the end of this week.',
            'InApp',
            'Pending',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '1 hour'
        ),
        (
            first_enum_value::notification_type_enum,
            'Parent-Teacher conference is scheduled for next Friday at 2:00 PM.',
            'InApp',
            'Sent',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '30 minutes'
        ),
        (
            first_enum_value::notification_type_enum,
            'Please update your profile information if any details have changed.',
            'InApp',
            'Pending',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Added sample notifications using enum value: %', first_enum_value;
    ELSE
        RAISE NOTICE 'No notification enum type found - notifications table might use text type';
        
        -- Try inserting with text values if no enum exists
        INSERT INTO notifications (
            type,
            message,
            delivery_mode,
            delivery_status,
            sent_by,
            created_at
        ) VALUES 
        (
            'general',
            'Welcome to the Teacher Dashboard! Your classes and schedule are now available.',
            'InApp',
            'Sent',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '1 day'
        ),
        (
            'general',
            'Please review your assigned classes and subjects for this semester.',
            'InApp',
            'Sent',
            admin_user_id,
            CURRENT_TIMESTAMP - INTERVAL '2 hours'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Added sample notifications using text type';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding notifications: %', SQLERRM;
END $$;

-- 4. Verify the notifications were added
SELECT 
    id,
    type,
    message,
    delivery_status,
    created_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;
