-- Fix notification_recipients table to support UPSERT operations
-- This adds a unique constraint on (notification_id, recipient_id) to prevent duplicates

-- First, let's check if there are any existing duplicate records
SELECT 
    notification_id, 
    recipient_id, 
    COUNT(*) as duplicate_count 
FROM notification_recipients 
GROUP BY notification_id, recipient_id 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- If duplicates exist, let's clean them up first
-- Keep only the most recent record for each (notification_id, recipient_id) combination
WITH duplicates AS (
    SELECT 
        id,
        notification_id,
        recipient_id,
        ROW_NUMBER() OVER (
            PARTITION BY notification_id, recipient_id 
            ORDER BY 
                CASE WHEN read_at IS NOT NULL THEN read_at ELSE sent_at END DESC,
                id DESC
        ) as row_num
    FROM notification_recipients
)
DELETE FROM notification_recipients 
WHERE id IN (
    SELECT id FROM duplicates WHERE row_num > 1
);

-- Now add the unique constraint
ALTER TABLE notification_recipients 
ADD CONSTRAINT unique_notification_recipient 
UNIQUE (notification_id, recipient_id);

-- Verify the constraint was added
SELECT 
    constraint_name, 
    constraint_type, 
    table_name 
FROM information_schema.table_constraints 
WHERE table_name = 'notification_recipients' 
AND constraint_name = 'unique_notification_recipient';

-- Check the current structure
\d notification_recipients;

-- Verify no duplicates remain
SELECT 
    notification_id, 
    recipient_id, 
    COUNT(*) as count 
FROM notification_recipients 
GROUP BY notification_id, recipient_id 
HAVING COUNT(*) > 1;
