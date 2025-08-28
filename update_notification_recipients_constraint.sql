-- CRITICAL: Update notification_recipients table to support Teacher and Admin recipient types
-- This MUST be run in Supabase SQL Editor BEFORE the hook will work correctly

-- 1. Check current constraint
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%recipient_type%';

-- 2. Drop the existing check constraint that only allows Student and Parent
ALTER TABLE notification_recipients 
DROP CONSTRAINT IF EXISTS notification_recipients_recipient_type_check;

-- 3. Add new constraint that includes Teacher and Admin recipient types
ALTER TABLE notification_recipients 
ADD CONSTRAINT notification_recipients_recipient_type_check 
CHECK (recipient_type = ANY (ARRAY['Student'::text, 'Parent'::text, 'Teacher'::text, 'Admin'::text]));

-- 4. Verify the new constraint was added successfully
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%recipient_type%';

-- 5. Test the new constraint by inserting sample notifications

-- Create a test notification
INSERT INTO notifications (type, message, delivery_status, created_at) 
VALUES ('announcement', 'Test notification for admin', 'Sent', CURRENT_TIMESTAMP);

-- Test Admin recipient type
INSERT INTO notification_recipients (notification_id, recipient_id, recipient_type, delivery_status, is_read)
VALUES (
    (SELECT id FROM notifications ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
    'Admin',
    'Sent',
    false
);

-- Create another test notification
INSERT INTO notifications (type, message, delivery_status, created_at) 
VALUES ('announcement', 'Test notification for teacher', 'Sent', CURRENT_TIMESTAMP);

-- Test Teacher recipient type
INSERT INTO notification_recipients (notification_id, recipient_id, recipient_type, delivery_status, is_read)
VALUES (
    (SELECT id FROM notifications ORDER BY created_at DESC LIMIT 1),
    (SELECT id FROM users WHERE email LIKE '%teacher%' LIMIT 1),
    'Teacher',
    'Sent',
    false
);

-- 6. Verify the test insertions worked
SELECT 
    nr.recipient_type,
    COUNT(*) as count
FROM notification_recipients nr
GROUP BY nr.recipient_type
ORDER BY nr.recipient_type;
