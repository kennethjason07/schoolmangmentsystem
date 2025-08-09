-- SQL Script to Migrate Existing Data to Maximus School
-- IMPORTANT: Run create_multi_school_schema.sql FIRST!
-- Then run this migration script

-- Step 1: Verify Maximus school exists (created by schema script)
SELECT 
    'Maximus school found!' as status,
    id as school_id,
    name,
    school_code
FROM schools WHERE name = 'Maximus';

-- Get the Maximus school ID for reference
-- This will be used automatically in the UPDATE queries below

-- Step 2: Update students table
UPDATE students 
SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
WHERE school_id IS NULL;

-- Step 3: Update classes table  
UPDATE classes 
SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
WHERE school_id IS NULL;

-- Step 4: Update users table (teachers, parents, admins)
UPDATE users 
SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
WHERE school_id IS NULL;

-- Step 5: Update other tables if they exist
-- Uncomment and run these if you have these tables:

-- UPDATE subjects 
-- SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
-- WHERE school_id IS NULL;

-- UPDATE student_attendance 
-- SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
-- WHERE school_id IS NULL;

-- UPDATE marks 
-- SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
-- WHERE school_id IS NULL;

-- UPDATE assignments 
-- SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
-- WHERE school_id IS NULL;

-- UPDATE announcements 
-- SET school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
-- WHERE school_id IS NULL;

-- Step 6: Check results
SELECT 
  'schools' as table_name,
  COUNT(*) as record_count
FROM schools WHERE name = 'Maximus'
UNION ALL
SELECT 
  'students' as table_name,
  COUNT(*) as record_count
FROM students WHERE school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
UNION ALL
SELECT 
  'classes' as table_name,
  COUNT(*) as record_count
FROM classes WHERE school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1)
UNION ALL
SELECT 
  'users' as table_name,
  COUNT(*) as record_count
FROM users WHERE school_id = (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1);

-- Step 7: Setup admin access for your user
-- Replace 'your-email@example.com' with your actual email
-- Replace 'your-user-id' with your actual user ID

-- First, find your user ID:
-- SELECT id, email FROM users WHERE email = 'your-email@example.com';

-- Then insert into school_users table:
-- INSERT INTO school_users (user_id, school_id, role_in_school, is_primary_school)
-- VALUES (
--   'your-user-id',
--   (SELECT id FROM schools WHERE name = 'Maximus' LIMIT 1),
--   'Admin',
--   true
-- );

-- Final verification query
SELECT 
  s.name as school_name,
  s.id as school_id,
  (SELECT COUNT(*) FROM students WHERE school_id = s.id) as students_count,
  (SELECT COUNT(*) FROM classes WHERE school_id = s.id) as classes_count,
  (SELECT COUNT(*) FROM users WHERE school_id = s.id) as users_count
FROM schools s 
WHERE s.name = 'Maximus';
