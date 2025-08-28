-- Check overall notification counts by recipient type
SELECT 
    recipient_type,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
    COUNT(*) FILTER (WHERE is_read = true) as read_notifications
FROM notification_recipients 
GROUP BY recipient_type
ORDER BY recipient_type;

-- Check admin users and their notification counts
SELECT 
    u.email,
    u.role_id,
    u.full_name,
    nr.recipient_type,
    COUNT(*) FILTER (WHERE nr.is_read = false) as unread_count,
    COUNT(*) as total_notifications
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
GROUP BY u.email, u.role_id, u.full_name, nr.recipient_type
ORDER BY u.email, nr.recipient_type;

-- Show specific unread admin notifications
SELECT 
    u.email,
    u.full_name,
    nr.id as recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.message,
    n.type,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id  
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
  AND nr.recipient_type = 'Admin'
  AND nr.is_read = false
ORDER BY n.created_at DESC;

-- Check if there are any inconsistent recipient types
SELECT 
    u.email,
    u.role_id,
    nr.recipient_type,
    COUNT(*) as count
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
GROUP BY u.email, u.role_id, nr.recipient_type
ORDER BY u.email, nr.recipient_type;
