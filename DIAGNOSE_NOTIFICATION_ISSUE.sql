-- DIAGNOSE NOTIFICATION ISSUE
-- Run this to find out why notifications aren't appearing

-- Step 1: Check if trigger exists
SELECT 'STEP 1: Checking if trigger exists...' as step;

SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN 'TRIGGER EXISTS ✓'
        ELSE 'TRIGGER MISSING ✗ - Run INSTALL_ABSENCE_TRIGGER.sql'
    END as trigger_status
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Step 2: Check recent attendance records
SELECT 'STEP 2: Checking recent attendance records...' as step;

SELECT 
    sa.id,
    sa.student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email,
    sa.date,
    sa.status,
    sa.created_at
FROM student_attendance sa
JOIN students s ON sa.student_id = s.id
LEFT JOIN users u ON s.parent_id = u.id
WHERE sa.status = 'Absent'
AND sa.date >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY sa.created_at DESC
LIMIT 10;

-- Step 3: Check if any notifications exist
SELECT 'STEP 3: Checking if any notifications exist...' as step;

SELECT 
    COUNT(*) as total_notifications,
    COUNT(CASE WHEN type = 'Absentee' THEN 1 END) as absentee_notifications,
    COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as notifications_today
FROM notifications;

-- Step 4: Check notification recipients
SELECT 'STEP 4: Checking notification recipients...' as step;

SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    u.full_name as recipient_name,
    u.email as recipient_email
FROM notifications n
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= CURRENT_DATE - INTERVAL '3 days'
ORDER BY n.created_at DESC
LIMIT 10;

-- Step 5: Check student-parent relationships
SELECT 'STEP 5: Checking student-parent relationships...' as step;

SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as students_with_parents,
    COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as students_without_parents
FROM students;

-- Show sample relationships
SELECT 
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email,
    u.role_id
FROM students s
LEFT JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
LIMIT 5;

-- Step 6: Manual test - Create absence and check if notification is created
SELECT 'STEP 6: Running manual test...' as step;

DO $$
DECLARE
    test_student_id UUID;
    test_class_id UUID;
    test_student_name TEXT;
    test_parent_id UUID;
    notifications_before INT;
    notifications_after INT;
BEGIN
    -- Count notifications before
    SELECT COUNT(*) INTO notifications_before
    FROM notifications 
    WHERE type = 'Absentee' AND created_at >= CURRENT_DATE;
    
    -- Find a student with parent
    SELECT s.id, s.class_id, s.name, s.parent_id
    INTO test_student_id, test_class_id, test_student_name, test_parent_id
    FROM students s
    WHERE s.parent_id IS NOT NULL 
    AND s.class_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        RAISE NOTICE 'Testing with student: % (ID: %), parent: %', 
            test_student_name, test_student_id, test_parent_id;
        
        -- Create absence record
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
        
        -- Wait a moment and count notifications after
        PERFORM pg_sleep(1);
        
        SELECT COUNT(*) INTO notifications_after
        FROM notifications 
        WHERE type = 'Absentee' AND created_at >= CURRENT_DATE;
        
        RAISE NOTICE 'Notifications before: %, after: %', notifications_before, notifications_after;
        
        IF notifications_after > notifications_before THEN
            RAISE NOTICE 'SUCCESS: Notification was created!';
        ELSE
            RAISE NOTICE 'PROBLEM: No notification was created!';
        END IF;
    ELSE
        RAISE NOTICE 'No student with parent found for testing';
    END IF;
END $$;

-- Step 7: Show latest notifications created
SELECT 'STEP 7: Latest notifications created...' as step;

SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    nr.recipient_id,
    u.full_name as parent_name,
    u.email as parent_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY n.created_at DESC;

-- Step 8: Diagnostic summary
SELECT 'STEP 8: DIAGNOSTIC SUMMARY' as step;

SELECT 
    'ISSUE DIAGNOSIS:' as diagnosis,
    CASE 
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'absence_notification_trigger'
        ) THEN 'TRIGGER NOT INSTALLED - Run INSTALL_ABSENCE_TRIGGER.sql'
        
        WHEN NOT EXISTS (
            SELECT 1 FROM students WHERE parent_id IS NOT NULL
        ) THEN 'NO STUDENT-PARENT RELATIONSHIPS - Link students to parents'
        
        WHEN NOT EXISTS (
            SELECT 1 FROM student_attendance 
            WHERE status = 'Absent' AND date >= CURRENT_DATE - INTERVAL '1 day'
        ) THEN 'NO RECENT ABSENCES - Mark a student absent to test'
        
        WHEN NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE type = 'Absentee' AND created_at >= CURRENT_DATE - INTERVAL '1 day'
        ) THEN 'TRIGGER NOT FIRING - Check trigger function and permissions'
        
        ELSE 'NOTIFICATIONS CREATED BUT NOT SHOWING IN APP - Check app notification fetching'
    END as likely_issue;

-- Final instructions
SELECT '
DIAGNOSTIC COMPLETE!

NEXT STEPS BASED ON RESULTS:

1. If TRIGGER MISSING:
   - Run INSTALL_ABSENCE_TRIGGER.sql

2. If NO STUDENT-PARENT RELATIONSHIPS:
   - Update students table: UPDATE students SET parent_id = ''parent-user-id'' WHERE id = ''student-id''

3. If TRIGGER NOT FIRING:
   - Check function permissions
   - Check if student_attendance table has proper structure

4. If NOTIFICATIONS CREATED BUT NOT IN APP:
   - Check parent app notification fetching
   - Verify parent user ID matches student parent_id
   - Check real-time subscription in parent app

5. To test manually:
   - Login as teacher
   - Mark a student absent
   - Check this diagnostic again to see if notification was created
' as next_steps;
