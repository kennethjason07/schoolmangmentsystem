-- Automated Absence Notification Trigger
-- This trigger automatically sends notifications to parents when students are marked absent

-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION send_absence_notification()
RETURNS TRIGGER AS $$
DECLARE
    student_record RECORD;
    parent_user_id UUID;
    notification_id UUID;
    formatted_date TEXT;
    notification_message TEXT;
BEGIN
    -- Only process if status is 'Absent'
    IF NEW.status = 'Absent' THEN
        -- Get student details and parent information
        SELECT 
            s.id,
            s.name,
            s.admission_no,
            s.parent_id,
            c.class_name,
            c.section
        INTO student_record
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE s.id = NEW.student_id;
        
        -- Check if student exists and has a parent
        IF student_record.id IS NOT NULL AND student_record.parent_id IS NOT NULL THEN
            -- Verify parent exists in users table
            SELECT id INTO parent_user_id
            FROM users
            WHERE id = student_record.parent_id;
            
            IF parent_user_id IS NOT NULL THEN
                -- Format the date for display
                formatted_date := TO_CHAR(NEW.date::DATE, 'Day, Month DD, YYYY');
                
                -- Create notification message
                notification_message := 'Your ward ' || student_record.name || 
                    CASE 
                        WHEN student_record.admission_no IS NOT NULL 
                        THEN ' (' || student_record.admission_no || ')' 
                        ELSE '' 
                    END ||
                    ' was absent today (' || formatted_date || '). Please contact the school if this is incorrect.';
                
                -- Check if notification already exists for this student and date
                IF NOT EXISTS (
                    SELECT 1 
                    FROM notifications n
                    JOIN notification_recipients nr ON n.id = nr.notification_id
                    WHERE n.type = 'Absentee'
                    AND nr.recipient_id = parent_user_id
                    AND n.created_at::DATE = NEW.date::DATE
                    AND n.message LIKE '%' || student_record.name || '%'
                ) THEN
                    -- Create notification record
                    INSERT INTO notifications (
                        type,
                        message,
                        delivery_mode,
                        delivery_status,
                        scheduled_at,
                        sent_by,
                        created_at
                    ) VALUES (
                        'Absentee',
                        notification_message,
                        'InApp',
                        'Sent',
                        NOW(),
                        NEW.marked_by,
                        NOW()
                    ) RETURNING id INTO notification_id;
                    
                    -- Create notification recipient record
                    INSERT INTO notification_recipients (
                        notification_id,
                        recipient_id,
                        recipient_type,
                        delivery_status,
                        sent_at,
                        is_read
                    ) VALUES (
                        notification_id,
                        parent_user_id,
                        'Parent',
                        'Sent',
                        NOW(),
                        false
                    );
                    
                    -- Log the notification creation
                    RAISE NOTICE 'Absence notification sent to parent % for student % on %', 
                        parent_user_id, student_record.name, NEW.date;
                END IF;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the trigger on student_attendance table
DROP TRIGGER IF EXISTS trigger_absence_notification ON student_attendance;

CREATE TRIGGER trigger_absence_notification
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION send_absence_notification();

-- Step 3: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_status_date 
ON student_attendance(status, date) 
WHERE status = 'Absent';

-- Step 4: Create an index for notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_type_date 
ON notifications(type, created_at) 
WHERE type = 'Absentee';

-- Step 5: Grant necessary permissions
GRANT EXECUTE ON FUNCTION send_absence_notification() TO authenticated;

-- Step 6: Test the trigger with a sample (optional - comment out in production)
/*
-- Test trigger functionality
DO $$
DECLARE
    test_student_id UUID;
    test_parent_id UUID;
    test_class_id UUID;
BEGIN
    -- Get a test student with parent
    SELECT s.id, s.parent_id, s.class_id 
    INTO test_student_id, test_parent_id, test_class_id
    FROM students s 
    WHERE s.parent_id IS NOT NULL 
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Insert test attendance record
        INSERT INTO student_attendance (
            student_id,
            class_id,
            date,
            status,
            marked_by
        ) VALUES (
            test_student_id,
            test_class_id,
            CURRENT_DATE,
            'Absent',
            NULL
        );
        
        RAISE NOTICE 'Test absence notification trigger executed for student %', test_student_id;
    ELSE
        RAISE NOTICE 'No test student found with parent relationship';
    END IF;
END $$;
*/

-- Step 7: Verify trigger creation
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_absence_notification';

-- Success message
SELECT 'Absence notification trigger created successfully! 
Students marked absent will automatically trigger notifications to parents.' as status;
