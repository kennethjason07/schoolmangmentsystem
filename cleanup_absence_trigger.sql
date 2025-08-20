-- Cleanup Script for Absence Notification Trigger
-- Use this to remove or reset the trigger system

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS trigger_absence_notification ON student_attendance;
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS send_absence_notification();
DROP FUNCTION IF EXISTS notify_parent_absence();
DROP FUNCTION IF EXISTS test_absence_trigger();

-- Step 3: Drop indexes (optional)
DROP INDEX IF EXISTS idx_student_attendance_status_date;
DROP INDEX IF EXISTS idx_notifications_type_date;

-- Step 4: Clean up test data (optional - be careful with this)
/*
-- Uncomment only if you want to remove test notifications
DELETE FROM notification_recipients 
WHERE notification_id IN (
    SELECT id FROM notifications 
    WHERE type = 'Absentee' 
    AND message LIKE '%test%'
);

DELETE FROM notifications 
WHERE type = 'Absentee' 
AND message LIKE '%test%';
*/

-- Step 5: Verify cleanup
SELECT 
    'Trigger cleanup completed. No absence notification triggers should be listed below:' as status;

SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_absence_notification', 'absence_notification_trigger');

SELECT 
    routine_name
FROM information_schema.routines 
WHERE routine_name IN ('send_absence_notification', 'notify_parent_absence', 'test_absence_trigger');

SELECT 'Cleanup completed successfully!' as final_status;
