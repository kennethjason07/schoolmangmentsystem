-- Add a simple Fee Reminder test notification
-- Run this in your Supabase SQL editor

-- Add one test Fee Reminder notification
INSERT INTO notifications (
    type,
    message,
    delivery_mode,
    delivery_status,
    sent_by,
    created_at
) VALUES (
    'Fee Reminder'::notification_type_enum,
    'TEST Fee Reminder: Your school fees for this semester are now due. Please make the payment by the end of this month to avoid late charges. Amount: ₹15,000.',
    'InApp',
    'Pending',
    (SELECT id FROM users WHERE role_id = 1 LIMIT 1),
    CURRENT_TIMESTAMP - INTERVAL '1 hour'
);

-- Verify the notification was added
SELECT 
    id,
    type,
    message,
    delivery_status,
    created_at
FROM notifications 
WHERE message LIKE '%TEST Fee Reminder%'
ORDER BY created_at DESC;
