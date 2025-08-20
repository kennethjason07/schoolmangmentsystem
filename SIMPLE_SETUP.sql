-- SIMPLE SETUP FOR ABSENCE NOTIFICATIONS
-- Copy and paste this entire script into Supabase SQL Editor and run it

-- Step 1: Create the notification trigger function
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
                
                RAISE NOTICE 'Absence notification created for student: %, parent: %', student_name, parent_id;
            END IF;
        ELSE
            RAISE NOTICE 'Missing data - Student: %, Parent ID: %', COALESCE(student_name, 'NULL'), COALESCE(parent_id::TEXT, 'NULL');
        END IF;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to send absence notification: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create the trigger
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
CREATE TRIGGER absence_notification_trigger
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_parent_absence();

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION notify_parent_absence() TO authenticated;

-- Step 4: Check setup
SELECT 'SETUP COMPLETE!' as status;

-- Step 5: Verify trigger exists
SELECT 
    'Trigger Status:' as check_type,
    trigger_name,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Step 6: Check student-parent relationships
SELECT 
    'Student-Parent Relationships:' as check_type,
    COUNT(*) as students_with_parents
FROM students 
WHERE parent_id IS NOT NULL;

-- Step 7: Show sample student-parent data
SELECT 
    'Sample Data:' as check_type,
    s.name as student_name,
    s.admission_no,
    u.full_name as parent_name,
    u.email as parent_email
FROM students s
JOIN users u ON s.parent_id = u.id
LIMIT 3;

-- Step 8: Create a test notification manually
DO $$
DECLARE
    test_student_id UUID;
    test_parent_id UUID;
    test_student_name TEXT;
    notification_id UUID;
BEGIN
    -- Get first student with parent
    SELECT s.id, s.parent_id, s.name
    INTO test_student_id, test_parent_id, test_student_name
    FROM students s
    WHERE s.parent_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Create test notification
        INSERT INTO notifications (
            type, message, delivery_mode, delivery_status, created_at
        ) VALUES (
            'Absentee', 
            'TEST: Your ward ' || test_student_name || ' was absent today. This is a test notification.',
            'InApp', 
            'Sent', 
            NOW()
        ) RETURNING id INTO notification_id;
        
        -- Create recipient
        INSERT INTO notification_recipients (
            notification_id, recipient_id, recipient_type, 
            delivery_status, sent_at, is_read
        ) VALUES (
            notification_id, test_parent_id, 'Parent', 'Sent', NOW(), false
        );
        
        RAISE NOTICE 'Test notification created for: %', test_student_name;
    END IF;
END $$;

-- Step 9: Show created notifications
SELECT 
    'Created Notifications:' as check_type,
    n.message,
    n.created_at,
    u.full_name as parent_name,
    u.email as parent_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= CURRENT_DATE
ORDER BY n.created_at DESC;

-- Final message
SELECT '
SETUP COMPLETE! 

NEXT STEPS:
1. Restart your parent app
2. Look for the orange DEBUG section on the dashboard
3. Click the Debug button to check relationships
4. Click the Test button to create a notification
5. Click the Refresh button to reload notifications

If you see notifications in the database above but not in the app,
the issue is with the app notification fetching.
' as instructions;
