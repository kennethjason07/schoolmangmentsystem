-- Migration Script for Existing Database Schema to Maximus School
-- This works with your current database structure

-- Step 1: Insert Maximus school in school_details table (if it doesn't exist)
INSERT INTO school_details (
    name, 
    type, 
    school_code, 
    is_active,
    address,
    phone,
    email,
    current_academic_year,
    created_at,
    updated_at
) 
SELECT 
    'Maximus',
    'Primary School',
    'MAX001',
    true,
    'Maximus School Address',
    '1234567890',
    'admin@maximus.edu',
    '2024-25',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM school_details 
    WHERE name ILIKE 'maximus' OR school_code = 'MAX001'
);

-- Step 2: Get the Maximus school ID and show it
SELECT 
    'Maximus school ready!' as status,
    id as school_id,
    name,
    school_code,
    type,
    is_active
FROM school_details 
WHERE name ILIKE 'maximus' OR school_code = 'MAX001'
LIMIT 1;

-- Step 3: Update all existing data to link to Maximus school

-- Update students
UPDATE students 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update classes
UPDATE classes 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update users
UPDATE users 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update teachers
UPDATE teachers 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update subjects
UPDATE subjects 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update student_attendance
UPDATE student_attendance 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update teacher_attendance
UPDATE teacher_attendance 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update marks
UPDATE marks 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update assignments
UPDATE assignments 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update exams
UPDATE exams 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update homeworks
UPDATE homeworks 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update fee_structure
UPDATE fee_structure 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update student_fees
UPDATE student_fees 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update parents
UPDATE parents 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update messages
UPDATE messages 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update notifications
UPDATE notifications 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update tasks
UPDATE tasks 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update personal_tasks
UPDATE personal_tasks 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Update timetable_entries
UPDATE timetable_entries 
SET school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001' LIMIT 1)
WHERE school_id IS NULL;

-- Step 4: Show migration results
SELECT 
    'Migration Summary' as info,
    'Record counts after linking to Maximus:' as description;

SELECT 
    'students' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001') THEN 1 END) as linked_to_maximus
FROM students
UNION ALL
SELECT 
    'classes' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001') THEN 1 END) as linked_to_maximus
FROM classes
UNION ALL
SELECT 
    'users' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001') THEN 1 END) as linked_to_maximus
FROM users
UNION ALL
SELECT 
    'teachers' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001') THEN 1 END) as linked_to_maximus
FROM teachers
UNION ALL
SELECT 
    'subjects' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN school_id = (SELECT id FROM school_details WHERE school_code = 'MAX001') THEN 1 END) as linked_to_maximus
FROM subjects
ORDER BY table_name;

-- Step 5: Final verification - Show Maximus school details and data counts
SELECT 
    s.name as school_name,
    s.id as school_id,
    s.school_code,
    s.type,
    s.is_active,
    (SELECT COUNT(*) FROM students WHERE school_id = s.id) as students_count,
    (SELECT COUNT(*) FROM classes WHERE school_id = s.id) as classes_count,
    (SELECT COUNT(*) FROM teachers WHERE school_id = s.id) as teachers_count,
    (SELECT COUNT(*) FROM users WHERE school_id = s.id) as users_count
FROM school_details s 
WHERE s.school_code = 'MAX001';

-- Step 6: Instructions for setting up user access
SELECT 
    'Next Steps for User Access:' as instructions,
    'Run these queries with your actual user email:' as description;

-- Copy these queries and replace 'your-email@example.com' with your actual email
-- SELECT id, email, full_name FROM users WHERE email = 'your-email@example.com';

-- Then use the user ID from above query in this INSERT:
-- INSERT INTO school_users (user_id, school_id, role_in_school, is_primary_school)
-- VALUES (
--   'your-user-id-from-above-query',
--   (SELECT id FROM school_details WHERE school_code = 'MAX001'),
--   'Admin',
--   true
-- ) ON CONFLICT (user_id, school_id) DO UPDATE SET
--   role_in_school = EXCLUDED.role_in_school,
--   is_primary_school = EXCLUDED.is_primary_school;
