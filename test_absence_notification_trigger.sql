-- Test Script for Absence Notification Trigger
-- Run this to verify the trigger is working correctly

-- Step 1: Check if trigger exists
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN ('trigger_absence_notification', 'absence_notification_trigger')
AND event_object_table = 'student_attendance';

-- Step 2: Check if function exists
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN ('send_absence_notification', 'notify_parent_absence')
AND routine_type = 'FUNCTION';

-- Step 3: Find a test student with parent relationship
SELECT 
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email,
    s.class_id
FROM students s
JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
LIMIT 5;

-- Step 4: Check existing notifications for comparison
SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.type = 'Absentee'
ORDER BY n.created_at DESC
LIMIT 10;

-- Step 5: Test the trigger (replace with actual student data)
-- IMPORTANT: Replace 'YOUR_STUDENT_ID' and 'YOUR_CLASS_ID' with real values from Step 3

/*
-- Uncomment and modify this section to test:

INSERT INTO student_attendance (
    student_id,
    class_id,
    date,
    status,
    marked_by,
    created_at
) VALUES (
    'YOUR_STUDENT_ID',  -- Replace with actual student ID from Step 3
    'YOUR_CLASS_ID',    -- Replace with actual class ID from Step 3
    CURRENT_DATE,
    'Absent',
    NULL,
    NOW()
);

-- Check if notification was created
SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_id,
    nr.recipient_type
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE n.type = 'Absentee'
AND DATE(n.created_at) = CURRENT_DATE
ORDER BY n.created_at DESC
LIMIT 5;
*/

-- Step 6: Create a safe test function that won't interfere with real data
CREATE OR REPLACE FUNCTION test_absence_trigger()
RETURNS TABLE(
    test_result TEXT,
    student_name TEXT,
    parent_email TEXT,
    notification_created BOOLEAN
) AS $$
DECLARE
    test_student_id UUID;
    test_class_id UUID;
    test_parent_id UUID;
    student_name_val TEXT;
    parent_email_val TEXT;
    notification_count INTEGER;
BEGIN
    -- Find a test student
    SELECT s.id, s.name, s.class_id, s.parent_id, u.email
    INTO test_student_id, student_name_val, test_class_id, test_parent_id, parent_email_val
    FROM students s
    JOIN users u ON s.parent_id = u.id
    WHERE s.parent_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Count notifications before
        SELECT COUNT(*) INTO notification_count
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        WHERE nr.recipient_id = test_parent_id
        AND n.type = 'Absentee'
        AND DATE(n.created_at) = CURRENT_DATE;
        
        -- Insert test attendance (this should trigger the notification)
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
        
        -- Check if notification was created
        RETURN QUERY
        SELECT 
            'Test completed'::TEXT,
            student_name_val,
            parent_email_val,
            EXISTS(
                SELECT 1 FROM notifications n
                JOIN notification_recipients nr ON n.id = nr.notification_id
                WHERE nr.recipient_id = test_parent_id
                AND n.type = 'Absentee'
                AND DATE(n.created_at) = CURRENT_DATE
                AND n.message LIKE '%' || student_name_val || '%'
            );
    ELSE
        RETURN QUERY
        SELECT 
            'No test student found'::TEXT,
            ''::TEXT,
            ''::TEXT,
            false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Instructions for manual testing
SELECT '
TESTING INSTRUCTIONS:
1. Run the queries above to check trigger setup
2. Find a student ID and class ID from Step 3
3. Uncomment and modify the INSERT statement in Step 5
4. Run the INSERT to test the trigger
5. Check the results with the SELECT query
6. Or use: SELECT * FROM test_absence_trigger(); for automated testing
' as instructions;
