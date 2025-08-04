-- Fix notifications schema and add sample data
-- Run this SQL in your Supabase SQL editor

-- 1. Check current notifications table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check notification_recipients table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'notification_recipients' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if we have any sample notifications
SELECT COUNT(*) as notification_count FROM notifications;
SELECT COUNT(*) as recipients_count FROM notification_recipients;

-- 4. Add some sample notifications for testing
-- (Uncomment the following if you need test data)

/*
-- Insert sample notifications
INSERT INTO notifications (
    id,
    type,
    message,
    delivery_mode,
    delivery_status,
    sent_by,
    created_at
) VALUES 
(
    gen_random_uuid(),
    'announcement',
    'Welcome to the new academic year! Please check your class schedules.',
    'InApp',
    'Sent',
    (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
    CURRENT_TIMESTAMP - INTERVAL '1 day'
),
(
    gen_random_uuid(),
    'task',
    'Please submit your monthly attendance report by end of this week.',
    'InApp',
    'Sent',
    (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
),
(
    gen_random_uuid(),
    'event',
    'Parent-Teacher meeting scheduled for next Friday at 2 PM.',
    'InApp',
    'Sent',
    (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
    CURRENT_TIMESTAMP - INTERVAL '3 hours'
),
(
    gen_random_uuid(),
    'personal_task',
    'Update your profile information in the system.',
    'InApp',
    'Pending',
    (SELECT id FROM users WHERE email LIKE '%admin%' LIMIT 1),
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
)
ON CONFLICT DO NOTHING;

-- Insert notification recipients for all teachers
INSERT INTO notification_recipients (
    notification_id,
    recipient_id,
    recipient_type,
    delivery_status
)
SELECT 
    n.id as notification_id,
    u.id as recipient_id,
    'Teacher' as recipient_type,
    'Sent' as delivery_status
FROM notifications n
CROSS JOIN users u
JOIN roles r ON u.role_id = r.id
WHERE r.role_name = 'teacher'
AND NOT EXISTS (
    SELECT 1 FROM notification_recipients nr 
    WHERE nr.notification_id = n.id AND nr.recipient_id = u.id
);
*/

-- 5. Alternative: Create a simpler notification system
-- If the current schema is too complex, we can add columns to notifications table

-- Check if sent_to_role column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'sent_to_role' 
AND table_schema = 'public';

-- Add sent_to_role and sent_to_id columns if they don't exist
-- (Uncomment if you want to simplify the schema)

/*
-- Add columns for simpler notification targeting
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS sent_to_role text,
ADD COLUMN IF NOT EXISTS sent_to_id uuid;

-- Add foreign key constraint for sent_to_id
ALTER TABLE notifications 
ADD CONSTRAINT notifications_sent_to_id_fkey 
FOREIGN KEY (sent_to_id) REFERENCES users(id);

-- Update existing notifications to have sent_to_role
UPDATE notifications 
SET sent_to_role = 'teacher' 
WHERE sent_to_role IS NULL;

-- Insert some simple sample notifications
INSERT INTO notifications (
    type,
    message,
    sent_to_role,
    delivery_status,
    created_at
) VALUES 
('announcement', 'Welcome to the new academic year!', 'teacher', 'Sent', CURRENT_TIMESTAMP - INTERVAL '1 day'),
('task', 'Please submit attendance reports', 'teacher', 'Sent', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('event', 'Parent-Teacher meeting next Friday', 'teacher', 'Sent', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
('personal_task', 'Update your profile', 'teacher', 'Pending', CURRENT_TIMESTAMP - INTERVAL '1 hour')
ON CONFLICT DO NOTHING;
*/

-- 6. Test notification queries
SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    COUNT(nr.id) as recipient_count
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
GROUP BY n.id, n.type, n.message, n.created_at
ORDER BY n.created_at DESC
LIMIT 5;
