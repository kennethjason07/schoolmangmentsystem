-- INSTALL ABSENCE NOTIFICATION TRIGGER
-- This will create notifications automatically when teachers mark students absent

-- Step 1: Clean up any existing triggers
DROP TRIGGER IF EXISTS absence_notification_trigger ON student_attendance;
DROP FUNCTION IF EXISTS notify_parent_absence();

-- Step 2: Create the notification function
CREATE OR REPLACE FUNCTION notify_parent_absence()
RETURNS TRIGGER AS $$
DECLARE
    student_name TEXT;
    student_admission_no TEXT;
    parent_id UUID;
    notification_msg TEXT;
    notification_id UUID;
BEGIN
    -- Only process when status is 'Absent'
    IF NEW.status = 'Absent' THEN
        RAISE NOTICE 'Processing absence for student_id: %', NEW.student_id;
        
        -- Get student and parent information
        SELECT s.name, s.admission_no, s.parent_id
        INTO student_name, student_admission_no, parent_id
        FROM students s
        WHERE s.id = NEW.student_id;
        
        RAISE NOTICE 'Found student: %, parent_id: %', student_name, parent_id;
        
        -- Only proceed if we have both student name and parent ID
        IF student_name IS NOT NULL AND parent_id IS NOT NULL THEN
            -- Create the notification message
            notification_msg := 'Your ward ' || student_name;
            
            -- Add admission number if available
            IF student_admission_no IS NOT NULL AND student_admission_no != '' THEN
                notification_msg := notification_msg || ' (' || student_admission_no || ')';
            END IF;
            
            -- Add the rest of the message
            notification_msg := notification_msg || ' was absent today (' || 
                TO_CHAR(NEW.date, 'DD/MM/YYYY') || '). Please contact the school if this is incorrect.';
            
            RAISE NOTICE 'Created message: %', notification_msg;
            
            -- Check if notification already exists for this student and date
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                JOIN notification_recipients nr ON n.id = nr.notification_id
                WHERE nr.recipient_id = parent_id
                AND n.type = 'Absentee'
                AND DATE(n.created_at) = NEW.date
                AND n.message LIKE '%' || student_name || '%'
            ) THEN
                RAISE NOTICE 'No duplicate found, creating notification...';
                
                -- Create the notification
                INSERT INTO notifications (
                    type,
                    message,
                    delivery_mode,
                    delivery_status,
                    created_at
                ) VALUES (
                    'Absentee',
                    notification_msg,
                    'InApp',
                    'Sent',
                    NOW()
                ) RETURNING id INTO notification_id;
                
                RAISE NOTICE 'Created notification with ID: %', notification_id;
                
                -- Create the notification recipient
                INSERT INTO notification_recipients (
                    notification_id,
                    recipient_id,
                    recipient_type,
                    delivery_status,
                    sent_at,
                    is_read
                ) VALUES (
                    notification_id,
                    parent_id,
                    'Parent',
                    'Sent',
                    NOW(),
                    false
                );
                
                RAISE NOTICE 'Created recipient record for parent: %', parent_id;
            ELSE
                RAISE NOTICE 'Duplicate notification exists, skipping...';
            END IF;
        ELSE
            RAISE NOTICE 'Missing data - Student: %, Parent ID: %', 
                COALESCE(student_name, 'NULL'), COALESCE(parent_id::TEXT, 'NULL');
        END IF;
    ELSE
        RAISE NOTICE 'Status is not Absent (%), skipping...', NEW.status;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in absence notification trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger
CREATE TRIGGER absence_notification_trigger
    AFTER INSERT OR UPDATE ON student_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_parent_absence();

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_parent_absence() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_parent_absence() TO anon;

-- Step 5: Verify installation
SELECT 'SUCCESS: Absence notification trigger installed!' as status;

-- Check if trigger exists
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Step 6: Test the trigger immediately
DO $$
DECLARE
    test_student_id UUID;
    test_class_id UUID;
    test_student_name TEXT;
    test_parent_id UUID;
    test_parent_name TEXT;
BEGIN
    -- Find a student with a parent
    SELECT s.id, s.class_id, s.name, s.parent_id, u.full_name
    INTO test_student_id, test_class_id, test_student_name, test_parent_id, test_parent_name
    FROM students s
    JOIN users u ON s.parent_id = u.id
    WHERE s.parent_id IS NOT NULL 
    AND s.class_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        RAISE NOTICE 'Testing with student: % (%), parent: % (%)', 
            test_student_name, test_student_id, test_parent_name, test_parent_id;
        
        -- Create a test absence record
        INSERT INTO student_attendance (
            student_id,
            class_id,
            date,
            status,
            created_at
        ) VALUES (
            test_student_id,
            test_class_id,
            CURRENT_DATE,
            'Absent',
            NOW()
        );
        
        RAISE NOTICE 'Test absence record created successfully!';
    ELSE
        RAISE NOTICE 'No suitable student found for testing';
    END IF;
END $$;

-- Step 7: Check if test notification was created
SELECT 
    'Test Results:' as check_type,
    n.id,
    n.message,
    n.created_at,
    nr.recipient_id,
    u.full_name as parent_name,
    u.email as parent_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY n.created_at DESC;

-- Final instructions
SELECT '
INSTALLATION COMPLETE!

NEXT STEPS:
1. Check the test results above
2. If you see a notification created, the trigger is working
3. Now test in your app:
   - Login as teacher
   - Mark any student absent
   - Login as parent of that student
   - Check notifications section

TROUBLESHOOTING:
- If no test notification above: Check student-parent relationships
- If trigger exists but no notifications: Check console logs in Supabase
- If notifications created but not in app: Check parent app notification fetching

The trigger will now automatically create notifications whenever a teacher marks a student absent!
' as instructions;
