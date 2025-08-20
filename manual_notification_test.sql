-- Manual Notification Test
-- Run this to manually create a notification and test the system

-- Step 1: Find a parent-student pair
SELECT 
    'STEP 1: Finding parent-student pairs' as step,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email
FROM students s
JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
LIMIT 5;

-- Step 2: Create a manual notification for testing
-- IMPORTANT: Replace the UUIDs below with actual values from Step 1

DO $$
DECLARE
    test_student_id UUID;
    test_parent_id UUID;
    test_student_name TEXT;
    notification_id UUID;
    notification_msg TEXT;
BEGIN
    -- Get the first student with a parent
    SELECT s.id, s.parent_id, s.name
    INTO test_student_id, test_parent_id, test_student_name
    FROM students s
    WHERE s.parent_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Create the notification message
        notification_msg := 'Your ward ' || test_student_name || ' was absent today (' || 
            TO_CHAR(CURRENT_DATE, 'DD/MM/YYYY') || '). Please contact the school if this is incorrect.';
        
        -- Create notification
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
        
        -- Create notification recipient
        INSERT INTO notification_recipients (
            notification_id,
            recipient_id,
            recipient_type,
            delivery_status,
            sent_at,
            is_read
        ) VALUES (
            notification_id,
            test_parent_id,
            'Parent',
            'Sent',
            NOW(),
            false
        );
        
        RAISE NOTICE 'Manual notification created successfully!';
        RAISE NOTICE 'Student: %, Parent: %, Notification ID: %', test_student_name, test_parent_id, notification_id;
    ELSE
        RAISE NOTICE 'No student with parent found!';
    END IF;
END $$;

-- Step 3: Verify the notification was created
SELECT 
    'STEP 3: Verifying notification creation' as step,
    n.id as notification_id,
    n.message,
    n.created_at,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    u.full_name as recipient_name,
    u.email as recipient_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= CURRENT_DATE
ORDER BY n.created_at DESC
LIMIT 5;

-- Step 4: Test the trigger by creating an attendance record
-- This will test if the trigger automatically creates notifications

DO $$
DECLARE
    test_student_id UUID;
    test_class_id UUID;
    test_student_name TEXT;
BEGIN
    -- Get a student with parent and class
    SELECT s.id, s.class_id, s.name
    INTO test_student_id, test_class_id, test_student_name
    FROM students s
    WHERE s.parent_id IS NOT NULL 
    AND s.class_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Insert attendance record (this should trigger the notification)
        INSERT INTO student_attendance (
            student_id,
            class_id,
            date,
            status,
            marked_by,
            created_at
        ) VALUES (
            test_student_id,
            test_class_id,
            CURRENT_DATE,
            'Absent',
            NULL,
            NOW()
        );
        
        RAISE NOTICE 'Test attendance record created for student: %', test_student_name;
    ELSE
        RAISE NOTICE 'No suitable student found for trigger test!';
    END IF;
END $$;

-- Step 5: Check if trigger created additional notifications
SELECT 
    'STEP 5: Checking trigger-generated notifications' as step,
    COUNT(*) as total_notifications_today
FROM notifications n
WHERE n.type = 'Absentee'
AND DATE(n.created_at) = CURRENT_DATE;

-- Step 6: Show all notifications created today
SELECT 
    'STEP 6: All absence notifications today' as step,
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
AND DATE(n.created_at) = CURRENT_DATE
ORDER BY n.created_at DESC;

-- Step 7: Instructions for parent app testing
SELECT '
NEXT STEPS FOR PARENT APP:
1. Login to parent app with the email shown above
2. Go to notifications section
3. Click "Refresh" button
4. You should see the absence notification(s)
5. If not visible, check console logs in parent app

PARENT EMAIL TO TEST WITH: Check the parent_email from Step 1 results above
' as instructions;
