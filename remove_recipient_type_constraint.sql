-- URGENT: Remove and update notification_recipients constraint
-- Run this in Supabase SQL Editor to fix the constraint error

-- 1. First, check what constraints exist
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%recipient_type%';

-- 2. Drop the existing constraint that's causing the error
ALTER TABLE notification_recipients 
DROP CONSTRAINT notification_recipients_recipient_type_check;

-- 3. Add new constraint that supports Admin, Teacher, Student, Parent
ALTER TABLE notification_recipients 
ADD CONSTRAINT notification_recipients_recipient_type_check 
CHECK (recipient_type = ANY (ARRAY['Student'::text, 'Parent'::text, 'Teacher'::text, 'Admin'::text]));

-- 4. Verify the constraint was updated successfully
SELECT 
    constraint_name, 
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%recipient_type%';

-- 5. Test that Admin recipient_type now works
INSERT INTO notifications (type, message, delivery_status) 
VALUES ('test', 'Testing Admin recipient type', 'Sent');

-- Get a test admin user
INSERT INTO notification_recipients (
    notification_id, 
    recipient_id, 
    recipient_type, 
    delivery_status, 
    is_read
) 
VALUES (
    (SELECT id FROM notifications WHERE message = 'Testing Admin recipient type' LIMIT 1),
    (SELECT id FROM users WHERE role_id = 1 LIMIT 1),
    'Admin',
    'Sent',
    false
);

-- 6. Clean up test data
DELETE FROM notification_recipients 
WHERE notification_id IN (
    SELECT id FROM notifications WHERE message = 'Testing Admin recipient type'
);

DELETE FROM notifications 
WHERE message = 'Testing Admin recipient type';

-- 7. Show final constraint
\d+ notification_recipients;
