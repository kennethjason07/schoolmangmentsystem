-- Debug Script for Absence Notifications
-- Run these queries to check if notifications are being created and why they might not appear

-- 1. Check if trigger exists and is active
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%absence%' OR trigger_name LIKE '%notification%';

-- 2. Check recent attendance records (especially absent ones)
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
AND sa.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sa.created_at DESC
LIMIT 20;

-- 3. Check all notifications created recently
SELECT 
    n.id,
    n.type,
    n.message,
    n.created_at,
    n.delivery_status
FROM notifications n
WHERE n.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.created_at DESC
LIMIT 20;

-- 4. Check notification recipients
SELECT 
    nr.id,
    nr.notification_id,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    n.type,
    n.message,
    n.created_at
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id
WHERE n.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY nr.sent_at DESC
LIMIT 20;

-- 5. Check specific Absentee notifications
SELECT 
    n.id as notification_id,
    n.message,
    n.created_at as notification_created,
    nr.recipient_id,
    nr.recipient_type,
    nr.is_read,
    nr.sent_at,
    u.full_name as recipient_name,
    u.email as recipient_email
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY n.created_at DESC;

-- 6. Check student-parent relationships
SELECT 
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email,
    u.role_id as parent_role
FROM students s
LEFT JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
ORDER BY s.name
LIMIT 20;

-- 7. Check for orphaned students (no parent relationship)
SELECT 
    s.id,
    s.name,
    s.admission_no,
    s.parent_id
FROM students s
WHERE s.parent_id IS NULL
ORDER BY s.name
LIMIT 10;

-- 8. Test trigger manually (replace with actual student ID)
-- IMPORTANT: Replace 'YOUR_STUDENT_ID' with a real student ID that has a parent
/*
DO $$
DECLARE
    test_student_id UUID := 'YOUR_STUDENT_ID'; -- Replace with actual student ID
    test_class_id UUID;
BEGIN
    -- Get class ID for the student
    SELECT class_id INTO test_class_id FROM students WHERE id = test_student_id;
    
    -- Insert test attendance record
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
    
    RAISE NOTICE 'Test attendance record inserted for student %', test_student_id;
END $$;
*/

-- 9. Check if notifications were created after manual test
-- Run this after the manual test above
SELECT 
    n.id,
    n.message,
    n.created_at,
    nr.recipient_id,
    u.full_name as parent_name
FROM notifications n
JOIN notification_recipients nr ON n.id = nr.notification_id
LEFT JOIN users u ON nr.recipient_id = u.id
WHERE n.type = 'Absentee'
AND n.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;

-- 10. Summary query - shows the complete flow
SELECT 
    'Summary of Recent Absence Notifications' as info,
    COUNT(DISTINCT sa.id) as absent_records_today,
    COUNT(DISTINCT n.id) as notifications_created_today,
    COUNT(DISTINCT nr.id) as recipients_today
FROM student_attendance sa
LEFT JOIN notifications n ON DATE(n.created_at) = CURRENT_DATE AND n.type = 'Absentee'
LEFT JOIN notification_recipients nr ON n.id = nr.notification_id
WHERE sa.status = 'Absent' 
AND sa.date = CURRENT_DATE;
