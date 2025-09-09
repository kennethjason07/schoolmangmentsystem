-- FIX SCRIPT: Correct Parent-Student Linkage
-- IMPORTANT: Run the diagnostic script first to identify the exact issue
-- Replace the placeholder values with actual IDs from your diagnostic results

-- SCENARIO 1: Fix linked_parent_of in users table
-- Use this when the users.linked_parent_of points to wrong student
-- Replace 'PARENT_EMAIL_HERE' with actual email and 'CORRECT_STUDENT_ID' with the right student ID

UPDATE users 
SET linked_parent_of = 'CORRECT_STUDENT_ID'  -- Replace with actual student ID
WHERE email = 'PARENT_EMAIL_HERE';           -- Replace with actual parent email

-- SCENARIO 2: Fix parent_id in students table  
-- Use this when student.parent_id points to wrong parent record
-- Replace 'STUDENT_ID_HERE' with actual student ID and 'CORRECT_PARENT_ID' with the right parent record ID

UPDATE students 
SET parent_id = 'CORRECT_PARENT_ID'          -- Replace with actual parent record ID
WHERE id = 'STUDENT_ID_HERE';                -- Replace with actual student ID

-- SCENARIO 3: Fix parent record in parents table
-- Use this when the parent record has wrong student_id
-- Replace 'PARENT_RECORD_ID' with the parent record ID and 'CORRECT_STUDENT_ID' with the right student ID

UPDATE parents 
SET student_id = 'CORRECT_STUDENT_ID'        -- Replace with actual student ID
WHERE id = 'PARENT_RECORD_ID';               -- Replace with actual parent record ID

-- SCENARIO 4: Create missing parent record
-- Use this when there's no parent record for the student
-- Replace all placeholder values with actual data

INSERT INTO parents (id, name, email, phone, student_id, relation, tenant_id)
VALUES (
    gen_random_uuid(),                       -- Auto-generate new ID
    'PARENT_NAME_HERE',                      -- Replace with parent name
    'PARENT_EMAIL_HERE',                     -- Replace with parent email  
    'PARENT_PHONE_HERE',                     -- Replace with parent phone
    'STUDENT_ID_HERE',                       -- Replace with student ID
    'Father',                                -- Or 'Mother', 'Guardian'
    'TENANT_ID_HERE'                         -- Replace with tenant ID
);

-- SCENARIO 5: Remove duplicate parent records
-- Use this when there are multiple parent records for same email+student
-- This keeps the most recent record and removes duplicates

DELETE FROM parents 
WHERE id NOT IN (
    SELECT DISTINCT ON (email, student_id) id
    FROM parents
    ORDER BY email, student_id, created_at DESC
);

-- VERIFICATION QUERIES
-- Run these after making changes to verify the fix worked

-- Verify user account linkage
SELECT 
    'VERIFICATION: User Account' as check_type,
    u.email,
    u.linked_parent_of,
    s.name as linked_student_name,
    s.admission_no
FROM users u
LEFT JOIN students s ON u.linked_parent_of = s.id
WHERE u.email = 'PARENT_EMAIL_HERE';         -- Replace with actual email

-- Verify parent records  
SELECT 
    'VERIFICATION: Parent Records' as check_type,
    p.email,
    p.student_id,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    CASE 
        WHEN s.parent_id = p.id THEN 'CORRECT'
        ELSE 'MISMATCH'
    END as parent_id_status
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE p.email = 'PARENT_EMAIL_HERE';         -- Replace with actual email

-- Verify student linkage
SELECT 
    'VERIFICATION: Student Parent Linkage' as check_type,
    s.name as student_name,
    s.admission_no,
    s.parent_id,
    p.name as parent_name,
    p.email as parent_email
FROM students s
LEFT JOIN parents p ON s.parent_id = p.id
WHERE s.id = 'STUDENT_ID_HERE';              -- Replace with student ID

-- Final consistency check
SELECT 
    'FINAL CHECK' as check_type,
    u.email as user_email,
    u.linked_parent_of as user_points_to_student,
    s1.name as user_linked_student_name,
    p.student_id as parent_record_points_to_student,
    s2.name as parent_record_student_name,
    s1.parent_id as student_points_to_parent,
    CASE 
        WHEN u.linked_parent_of = p.student_id AND s1.parent_id = p.id 
        THEN 'ALL CONSISTENT ✅'
        ELSE 'STILL HAS ISSUES ❌'
    END as overall_status
FROM users u
LEFT JOIN students s1 ON u.linked_parent_of = s1.id
LEFT JOIN parents p ON p.email = u.email
LEFT JOIN students s2 ON p.student_id = s2.id
WHERE u.email = 'PARENT_EMAIL_HERE';         -- Replace with actual email
