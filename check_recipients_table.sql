-- Check the structure of notification_recipients table
-- to ensure it has the sent_by field

-- Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notification_recipients'
ORDER BY ordinal_position;

-- Check recent recipient records
SELECT 
  nr.id,
  nr.notification_id,
  nr.recipient_id,
  nr.recipient_type,
  nr.is_read,
  nr.delivery_status,
  nr.sent_by,
  n.type as notification_type,
  n.message as notification_message,
  u.full_name as sender_name
FROM notification_recipients nr
LEFT JOIN notifications n ON nr.notification_id = n.id  
LEFT JOIN users u ON nr.sent_by = u.id
ORDER BY nr.id DESC
LIMIT 10;

-- Count recipients by delivery status
SELECT 
  delivery_status,
  COUNT(*) as count
FROM notification_recipients
GROUP BY delivery_status;
