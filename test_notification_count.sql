-- Check the current state of notification_recipients table
SELECT 
    recipient_type,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
    COUNT(*) FILTER (WHERE is_read = true) as read_notifications
FROM notification_recipients 
GROUP BY recipient_type
ORDER BY recipient_type;

-- Check all Teacher notifications specifically
SELECT 
    nr.id,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.message,
    n.type,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id
WHERE nr.recipient_type = 'Teacher'
ORDER BY n.created_at DESC;

-- Check all Admin notifications specifically  
SELECT 
    nr.id,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.message,
    n.type,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id
WHERE nr.recipient_type = 'Admin'
ORDER BY n.created_at DESC;

-- Check users table to see teacher and admin users
SELECT 
    id,
    email,
    role_id,
    full_name,
    linked_teacher_id
FROM users 
WHERE role_id IN (1, 2)  -- 1=Admin, 2=Teacher (assuming)
ORDER BY role_id, email;

-- Check if there are any notifications with Student/Parent recipient_type that should be Teacher/Admin
SELECT 
    nr.recipient_type,
    u.role_id,
    u.email,
    COUNT(*) as notification_count
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
GROUP BY nr.recipient_type, u.role_id, u.email
ORDER BY u.role_id, nr.recipient_type;
