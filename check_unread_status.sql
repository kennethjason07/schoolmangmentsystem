-- Check the unread status of the specific Teacher notification for hanokalure@gmail.com
SELECT 
    u.email,
    u.role_id,
    nr.id as recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.read_at,
    n.message,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id  
JOIN users u ON nr.recipient_id = u.id
WHERE u.email = 'hanokalure@gmail.com' 
  AND nr.recipient_type = 'Teacher'
ORDER BY n.created_at DESC;

-- Check the unread status of Admin notifications for kenj7214@gmail.com
SELECT 
    u.email,
    u.role_id,
    nr.id as recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.read_at,
    n.message,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id  
JOIN users u ON nr.recipient_id = u.id
WHERE u.email = 'kenj7214@gmail.com' 
  AND nr.recipient_type = 'Admin'
ORDER BY n.created_at DESC;

-- Count unread notifications for both users
SELECT 
    u.email,
    u.role_id,
    nr.recipient_type,
    COUNT(*) FILTER (WHERE nr.is_read = false) as unread_count,
    COUNT(*) as total_notifications
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
WHERE u.email IN ('hanokalure@gmail.com', 'kenj7214@gmail.com')
GROUP BY u.email, u.role_id, nr.recipient_type
ORDER BY u.email, nr.recipient_type;
