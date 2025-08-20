-- Simple Absence Notification Trigger
-- Automatically sends notifications when students are marked absent

-- Create the notification function
CREATE OR REPLACE FUNCTION notify_parent_absence()
RETURNS TRIGGER AS $$
DECLARE
    student_name TEXT;
    student_admission_no TEXT;
    parent_id UUID;
    notification_msg TEXT;
    notification_id UUID;
BEGIN
    -- Only process absent status
    IF NEW.status = 'Absent' THEN
        -- Get student and parent info
        SELECT s.name, s.admission_no, s.parent_id
        INTO student_name, student_admission_no, parent_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        -- Check if we have valid data
        IF student_name IS NOT NULL AND parent_id IS NOT NULL THEN
            -- Create message
            notification_msg := 'Your ward ' || student_name;
            
            IF student_admission_no IS NOT NULL THEN
                notification_msg := notification_msg || ' (' || student_admission_no || ')';
            END IF;
            
            notification_msg := notification_msg || ' was absent today (' || 
                TO_CHAR(NEW.date, 'DD/MM/YYYY') || '). Please contact the school if this is incorrect.';
            
            -- Check if notification already exists for today
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                JOIN notification_recipients nr ON n.id = nr.notification_id
                WHERE nr.recipient_id = parent_id
                AND n.type = 'Absentee'
                AND DATE(n.created_at) = NEW.date
                AND n.message LIKE '%' || student_name || '%'
            ) THEN
                -- Create notification
                INSERT INTO notifications (
                    type, message, delivery_mode, delivery_status, created_at
                ) VALUES (
                    'Absentee', notification_msg, 'InApp', 'Sent', NOW()
                ) RETURNING id INTO notification_id;
                
                -- Create recipient
                INSERT INTO notification_recipients (
                    notification_id, recipient_id, recipient_type, 
                    delivery_status, sent_at, is_read
                ) VALUES (
                    notification_id, parent_id, 'Parent', 'Sent', NOW(), false
                );
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the attendance update
        RAISE WARNING 'Failed to send absence notification: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
CREATE TRIGGER absence_notification_trigger
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_parent_absence();

-- Grant permissions
GRANT EXECUTE ON FUNCTION notify_parent_absence() TO authenticated;

-- Verify trigger
SELECT 'Simple absence notification trigger created successfully!' as status;
