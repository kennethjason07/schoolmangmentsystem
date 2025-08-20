-- TEST SCRIPT: Verify Absence Notification System
-- Run this to test if notifications are created when students are marked absent

-- Step 1: Check current setup
SELECT 'STEP 1: Checking system setup...' as step;

-- Verify trigger exists
SELECT 
    'Trigger Status:' as check_type,
    CASE 
        WHEN COUNT(*) > 0 THEN 'INSTALLED ✓'
        ELSE 'MISSING ✗'
    END as status
FROM information_schema.triggers 
WHERE trigger_name = 'absence_notification_trigger';

-- Check student-parent relationships
SELECT 
    'Student-Parent Links:' as check_type,
    COUNT(*) as students_with_parents
FROM students 
WHERE parent_id IS NOT NULL;

-- Step 2: Find a test student
SELECT 'STEP 2: Finding test student...' as step;

SELECT 
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.class_id,
    s.parent_id,
    u.full_name as parent_name,
    u.email as parent_email
FROM students s
JOIN users u ON s.parent_id = u.id
WHERE s.parent_id IS NOT NULL
AND s.class_id IS NOT NULL
LIMIT 1;

-- Step 3: Create test absence (this will trigger the notification)
SELECT 'STEP 3: Creating test absence...' as step;

DO $$
DECLARE
    test_student_id UUID;
    test_class_id UUID;
    test_student_name TEXT;
    test_parent_id UUID;
BEGIN
    -- Get first student with parent and class
    SELECT s.id, s.class_id, s.name, s.parent_id
    INTO test_student_id, test_class_id, test_student_name, test_parent_id
    FROM students s
    WHERE s.parent_id IS NOT NULL 
    AND s.class_id IS NOT NULL
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Create absence record (this should trigger notification)
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
        
        RAISE NOTICE 'Test absence created for: % (Parent: %)', test_student_name, test_parent_id;
    ELSE
        RAISE NOTICE 'No suitable student found for testing!';
    END IF;
END $$;

-- Step 4: Check if notification was created
SELECT 'STEP 4: Checking if notification was created...' as step;

-- Show notifications created today
SELECT 
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

-- Step 5: Summary
SELECT 'STEP 5: Summary' as step;

SELECT 
    'Total absence notifications today:' as metric,
    COUNT(*) as count
FROM notifications 
WHERE type = 'Absentee' 
AND DATE(created_at) = CURRENT_DATE;

SELECT 
    'Total notification recipients today:' as metric,
    COUNT(*) as count
FROM notification_recipients nr
JOIN notifications n ON nr.notification_id = n.id
WHERE n.type = 'Absentee'
AND DATE(n.created_at) = CURRENT_DATE;

-- Instructions
SELECT '
TEST COMPLETE!

WHAT TO DO NEXT:
1. Check the results above
2. If notifications were created, the system is working
3. Now test in the app:
   - Login as teacher
   - Mark a student absent
   - Login as parent (of that student)
   - Check notifications section
   - Should see absence notification immediately

TROUBLESHOOTING:
- If no notifications created: Trigger not working
- If notifications created but not in app: App notification fetching issue
- If parent sees no notifications: Check parent-student relationship
' as instructions;
