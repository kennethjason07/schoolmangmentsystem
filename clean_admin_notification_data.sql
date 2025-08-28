-- First, let's see what admin notifications exist
SELECT 
    u.email,
    u.full_name,
    nr.recipient_type,
    nr.is_read,
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

-- If you find old/stale notifications, you can mark them as read or delete them
-- To mark all admin notifications as read (uncomment if needed):
-- UPDATE notification_recipients 
-- SET is_read = true, read_at = NOW()
-- WHERE recipient_type = 'Admin' AND is_read = false;

-- To delete very old notifications (older than 30 days, uncomment if needed):
-- DELETE FROM notification_recipients 
-- WHERE id IN (
--   SELECT nr.id 
--   FROM notification_recipients nr
--   JOIN notifications n ON nr.notification_id = n.id
--   WHERE nr.recipient_type = 'Admin' 
--     AND n.created_at < NOW() - INTERVAL '30 days'
-- );

-- Check notification counts by type after cleanup
SELECT 
    recipient_type,
    COUNT(*) as total_notifications,
    COUNT(*) FILTER (WHERE is_read = false) as unread_notifications,
    COUNT(*) FILTER (WHERE is_read = true) as read_notifications
FROM notification_recipients 
GROUP BY recipient_type
ORDER BY recipient_type;
