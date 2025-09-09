-- DIAGNOSTIC SCRIPT: Parent-Student Linkage Mismatch Investigation
-- Replace 'PARENT_EMAIL_HERE' with the actual parent's email address

-- Step 1: Check the parent's user account
SELECT 
    'USER ACCOUNT' as section,
    id as user_id,
    email,
    full_name,
    linked_parent_of,
    linked_student_id,
    role_id,
    created_at
FROM users 
WHERE email = 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 2: Check what student is linked via linked_parent_of
SELECT 
    'LINKED STUDENT (via linked_parent_of)' as section,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.roll_no,
    s.parent_id,
    c.class_name,
    c.section,
    'This is what the app SHOULD show' as note
FROM users u
JOIN students s ON u.linked_parent_of = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE u.email = 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 3: Check what student is linked via linked_student_id (if any)
SELECT 
    'LINKED STUDENT (via linked_student_id)' as section,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.roll_no,
    s.parent_id,
    c.class_name,
    c.section,
    'This field is usually for student accounts, not parents' as note
FROM users u
JOIN students s ON u.linked_student_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE u.email = 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 4: Check all parent records for this email
SELECT 
    'PARENT RECORDS' as section,
    p.id as parent_record_id,
    p.name as parent_name,
    p.email,
    p.student_id,
    s.name as student_name,
    s.admission_no,
    c.class_name,
    c.section,
    p.relation,
    'All parent records with this email' as note
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE p.email = 'PARENT_EMAIL_HERE'  -- Replace with actual email
ORDER BY p.created_at;

-- Step 5: Check if there are students that point back to parent records
SELECT 
    'STUDENTS POINTING TO PARENT RECORDS' as section,
    s.id as student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    p.name as parent_name,
    p.email as parent_email,
    c.class_name,
    c.section,
    'Students linked via parent_id' as note
FROM students s
JOIN parents p ON s.parent_id = p.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE p.email = 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 6: Find any other user accounts that might be linked to the same students
SELECT 
    'OTHER USER ACCOUNTS' as section,
    u.id as user_id,
    u.email,
    u.full_name,
    u.linked_parent_of,
    s.name as student_name,
    s.admission_no,
    'Other users linked to same students' as note
FROM users u
JOIN students s ON (u.linked_parent_of = s.id OR u.linked_student_id = s.id)
WHERE s.id IN (
    SELECT DISTINCT student_id 
    FROM parents 
    WHERE email = 'PARENT_EMAIL_HERE'  -- Replace with actual email
)
AND u.email != 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 7: Check for data inconsistencies
SELECT 
    'INCONSISTENCIES' as section,
    'linked_parent_of vs parent records' as issue_type,
    u.email,
    u.linked_parent_of,
    p.student_id as parent_record_student_id,
    CASE 
        WHEN u.linked_parent_of = p.student_id THEN 'CONSISTENT'
        ELSE 'MISMATCH - This could be the problem!'
    END as status
FROM users u
CROSS JOIN parents p
WHERE u.email = 'PARENT_EMAIL_HERE'  -- Replace with actual email
AND p.email = 'PARENT_EMAIL_HERE';   -- Replace with actual email

-- Step 8: Summary - What should be the correct setup
SELECT 
    'RECOMMENDED SETUP' as section,
    'For parent: ' || u.email as description,
    'linked_parent_of should point to: ' || 
    COALESCE(
        (SELECT string_agg(s.name || ' (ID: ' || s.id || ')', ', ')
         FROM parents p 
         JOIN students s ON p.student_id = s.id 
         WHERE p.email = u.email), 
        'No students found'
    ) as recommendation
FROM users u
WHERE u.email = 'PARENT_EMAIL_HERE';  -- Replace with actual email

-- Step 9: Check if the problem is in the SelectedStudentContext logic
-- This shows what the current (old) logic would return
WITH primary_student AS (
    SELECT s.id, s.name, s.parent_id
    FROM users u
    JOIN students s ON u.linked_parent_of = s.id
    WHERE u.email = 'PARENT_EMAIL_HERE'  -- Replace with actual email
),
parent_records AS (
    SELECT DISTINCT p.student_id
    FROM parents p
    WHERE p.email = 'PARENT_EMAIL_HERE'  -- Replace with actual email
)
SELECT 
    'CONTEXT LOGIC ANALYSIS' as section,
    CASE 
        WHEN ps.id IS NOT NULL THEN 'Primary student: ' || ps.name || ' (ID: ' || ps.id || ')'
        ELSE 'No primary student found'
    END as primary_student,
    CASE 
        WHEN pr.student_id IS NOT NULL THEN 'Parent records point to student IDs: ' || 
            (SELECT string_agg(student_id::text, ', ') FROM parent_records)
        ELSE 'No parent records found'
    END as parent_record_students,
    CASE 
        WHEN ps.id IS NOT NULL AND EXISTS (SELECT 1 FROM parent_records WHERE student_id = ps.id) 
        THEN 'CONSISTENT - Primary student matches parent records'
        WHEN ps.id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parent_records WHERE student_id = ps.id)
        THEN 'MISMATCH - Primary student differs from parent records'
        ELSE 'MISSING DATA'
    END as analysis
FROM primary_student ps
FULL OUTER JOIN parent_records pr ON ps.id = pr.student_id;
