-- Enhanced Absence Notification Trigger with Debug Logging
-- This version includes detailed logging to help debug issues

-- Create a log table for debugging (optional)
CREATE TABLE IF NOT EXISTS notification_debug_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID,
    student_name TEXT,
    parent_id UUID,
    parent_name TEXT,
    message TEXT,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced notification function with debugging
CREATE OR REPLACE FUNCTION notify_parent_absence_debug()
RETURNS TRIGGER AS $$
DECLARE
    student_name TEXT;
    student_admission_no TEXT;
    parent_id UUID;
    parent_name TEXT;
    notification_msg TEXT;
    notification_id UUID;
    debug_status TEXT := 'started';
    debug_error TEXT := NULL;
BEGIN
    -- Log that trigger started
    RAISE NOTICE 'ABSENCE TRIGGER: Started for student_id=%, status=%', NEW.student_id, NEW.status;
    
    -- Only process absent status
    IF NEW.status = 'Absent' THEN
        debug_status := 'processing_absent';
        RAISE NOTICE 'ABSENCE TRIGGER: Processing absent status';
        
        -- Get student and parent info
        SELECT s.name, s.admission_no, s.parent_id, u.full_name
        INTO student_name, student_admission_no, parent_id, parent_name
        FROM students s
        LEFT JOIN users u ON s.parent_id = u.id
        WHERE s.id = NEW.student_id;
        
        RAISE NOTICE 'ABSENCE TRIGGER: Found student=%, parent_id=%, parent_name=%', 
            student_name, parent_id, parent_name;
        
        -- Check if we have valid data
        IF student_name IS NOT NULL AND parent_id IS NOT NULL THEN
            debug_status := 'creating_message';
            
            -- Create message
            notification_msg := 'Your ward ' || student_name;
            
            IF student_admission_no IS NOT NULL THEN
                notification_msg := notification_msg || ' (' || student_admission_no || ')';
            END IF;
            
            notification_msg := notification_msg || ' was absent today (' || 
                TO_CHAR(NEW.date, 'DD/MM/YYYY') || '). Please contact the school if this is incorrect.';
            
            RAISE NOTICE 'ABSENCE TRIGGER: Created message: %', notification_msg;
            
            -- Check if notification already exists for today
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                JOIN notification_recipients nr ON n.id = nr.notification_id
                WHERE nr.recipient_id = parent_id
                AND n.type = 'Absentee'
                AND DATE(n.created_at) = NEW.date
                AND n.message LIKE '%' || student_name || '%'
            ) THEN
                debug_status := 'creating_notification';
                RAISE NOTICE 'ABSENCE TRIGGER: No duplicate found, creating notification';
                
                -- Create notification
                INSERT INTO notifications (
                    type, message, delivery_mode, delivery_status, created_at
                ) VALUES (
                    'Absentee', notification_msg, 'InApp', 'Sent', NOW()
                ) RETURNING id INTO notification_id;
                
                RAISE NOTICE 'ABSENCE TRIGGER: Created notification with ID: %', notification_id;
                
                -- Create recipient
                INSERT INTO notification_recipients (
                    notification_id, recipient_id, recipient_type, 
                    delivery_status, sent_at, is_read
                ) VALUES (
                    notification_id, parent_id, 'Parent', 'Sent', NOW(), false
                );
                
                debug_status := 'completed_successfully';
                RAISE NOTICE 'ABSENCE TRIGGER: Created recipient record for parent: %', parent_id;
                
            ELSE
                debug_status := 'duplicate_skipped';
                RAISE NOTICE 'ABSENCE TRIGGER: Duplicate notification exists, skipping';
            END IF;
        ELSE
            debug_status := 'missing_data';
            debug_error := 'Student name: ' || COALESCE(student_name, 'NULL') || 
                          ', Parent ID: ' || COALESCE(parent_id::TEXT, 'NULL');
            RAISE NOTICE 'ABSENCE TRIGGER: Missing required data - %', debug_error;
        END IF;
    ELSE
        debug_status := 'not_absent';
        RAISE NOTICE 'ABSENCE TRIGGER: Status is not Absent (%), skipping', NEW.status;
    END IF;
    
    -- Log to debug table
    INSERT INTO notification_debug_log (
        student_id, student_name, parent_id, parent_name, 
        message, status, error_message
    ) VALUES (
        NEW.student_id, student_name, parent_id, parent_name,
        notification_msg, debug_status, debug_error
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the attendance update
        debug_error := SQLERRM;
        RAISE WARNING 'ABSENCE TRIGGER: Failed to send absence notification: %', debug_error;
        
        -- Log error to debug table
        INSERT INTO notification_debug_log (
            student_id, student_name, parent_id, parent_name,
            message, status, error_message
        ) VALUES (
            NEW.student_id, COALESCE(student_name, 'unknown'), 
            parent_id, COALESCE(parent_name, 'unknown'),
            COALESCE(notification_msg, 'failed_to_create'), 'error', debug_error
        );
        
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger and create new one
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
DROP TRIGGER IF EXISTS absence_notification_debug_trigger ON student_attendance;

CREATE TRIGGER absence_notification_debug_trigger
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_parent_absence_debug();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_parent_absence_debug() TO authenticated;

-- Create a function to check debug logs
CREATE OR REPLACE FUNCTION get_notification_debug_summary()
RETURNS TABLE(
    total_attempts INTEGER,
    successful INTEGER,
    failed INTEGER,
    duplicates_skipped INTEGER,
    missing_data INTEGER,
    recent_errors TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_attempts,
        COUNT(CASE WHEN status = 'completed_successfully' THEN 1 END)::INTEGER as successful,
        COUNT(CASE WHEN status = 'error' THEN 1 END)::INTEGER as failed,
        COUNT(CASE WHEN status = 'duplicate_skipped' THEN 1 END)::INTEGER as duplicates_skipped,
        COUNT(CASE WHEN status = 'missing_data' THEN 1 END)::INTEGER as missing_data,
        ARRAY_AGG(DISTINCT error_message) FILTER (WHERE error_message IS NOT NULL) as recent_errors
    FROM notification_debug_log
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Debug absence notification trigger created successfully! 
Check notification_debug_log table and use get_notification_debug_summary() for debugging.' as status;
