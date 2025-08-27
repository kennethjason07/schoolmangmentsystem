-- Update all notifications from 'Pending' to 'Sent' status
-- This reflects that they are being displayed to students in the app

-- First, let's see current status distribution
SELECT 
  delivery_status,
  COUNT(*) as count
FROM notifications 
GROUP BY delivery_status;

-- Update all pending notifications to sent (since they're being shown in app)
UPDATE notifications 
SET 
  delivery_status = 'Sent',
  sent_at = COALESCE(sent_at, created_at) -- Set sent_at to created_at if it's null
WHERE delivery_status = 'Pending'
  AND delivery_mode = 'InApp'; -- Only update InApp notifications

-- Verify the update
SELECT 
  delivery_status,
  COUNT(*) as count
FROM notifications 
GROUP BY delivery_status;

-- Show recent notifications with their updated status
SELECT 
  id,
  type,
  LEFT(message, 50) as message_preview,
  delivery_status,
  delivery_mode,
  created_at,
  sent_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;
