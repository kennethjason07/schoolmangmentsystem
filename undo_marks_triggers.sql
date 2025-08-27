-- Undo all marks notification triggers and functions
-- This script removes the automatic notification system and prepares for manual notification storage

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_marks_notification ON marks;
DROP TRIGGER IF EXISTS trigger_marks_notification_update ON marks;
DROP TRIGGER IF EXISTS trigger_marks_notification_delete ON marks;

-- Drop the marks_notification function
DROP FUNCTION IF EXISTS marks_notification(UUID);
DROP FUNCTION IF EXISTS marks_notification();

-- Drop any other related notification functions
DROP FUNCTION IF EXISTS notify_parents_of_marks(UUID);
DROP FUNCTION IF EXISTS send_marks_notification(UUID);

-- Remove any existing notification tables if they exist
DROP TABLE IF EXISTS mark_notifications CASCADE;
DROP TABLE IF EXISTS parent_notifications CASCADE;

COMMENT ON SCHEMA public IS 'Removed automatic marks notification triggers and functions - switching to manual notification storage system';
