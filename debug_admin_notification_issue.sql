-- Debug script to find why admin dashboard shows count 2 instead of 0

-- 1. Check all admin users
SELECT 'ADMIN USERS' as debug_step;
SELECT 
    id,
    email,
    role_id,
    full_name
FROM users 
WHERE role_id = 1
ORDER BY email;

-- 2. Check notification_recipients for each admin user
SELECT 'NOTIFICATION RECIPIENTS FOR ADMIN USERS' as debug_step;
SELECT 
    u.email as admin_email,
    u.id as admin_user_id,
    nr.recipient_type,
    nr.is_read,
    COUNT(*) as count
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
GROUP BY u.email, u.id, nr.recipient_type, nr.is_read
ORDER BY u.email, nr.recipient_type, nr.is_read;

-- 3. Check specific unread admin notifications
SELECT 'UNREAD ADMIN NOTIFICATIONS DETAILS' as debug_step;
SELECT 
    u.email as admin_email,
    nr.id as recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.id as notification_id,
    n.message,
    n.type,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id  
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
  AND nr.is_read = false
ORDER BY u.email, n.created_at DESC;

-- 4. Check if admin users have notifications with wrong recipient_type
SELECT 'ADMIN USERS WITH NON-ADMIN RECIPIENT TYPE' as debug_step;
SELECT 
    u.email as admin_email,
    nr.recipient_type,
    nr.is_read,
    COUNT(*) as count
FROM notification_recipients nr
JOIN users u ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users (should only have recipient_type = 'Admin')
  AND nr.recipient_type != 'Admin'
GROUP BY u.email, nr.recipient_type, nr.is_read
ORDER BY u.email, nr.recipient_type;

-- 5. Check the exact count that should be returned by the hook
SELECT 'EXACT UNREAD COUNT FOR EACH ADMIN USER' as debug_step;
SELECT 
    u.email as admin_email,
    u.id as admin_user_id,
    COUNT(*) FILTER (WHERE nr.recipient_type = 'Admin' AND nr.is_read = false) as unread_admin_count,
    COUNT(*) FILTER (WHERE nr.recipient_type = 'Admin') as total_admin_count
FROM users u
LEFT JOIN notification_recipients nr ON nr.recipient_id = u.id
WHERE u.role_id = 1  -- Admin users
GROUP BY u.email, u.id
ORDER BY u.email;
