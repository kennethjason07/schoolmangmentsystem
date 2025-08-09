-- This script creates sample data to fix the teacher relationships
-- Run these queries in your Supabase SQL editor

-- 1. First, let's see what we have
-- SELECT * FROM classes LIMIT 5;
-- SELECT * FROM teachers LIMIT 5;
-- SELECT * FROM subjects LIMIT 5;
-- SELECT * FROM students LIMIT 5;

-- 2. Create a sample class (adjust the school_id if needed)
INSERT INTO classes (class_name, section, academic_year, school_id) 
VALUES ('10th', 'A', '2024-25', (SELECT id FROM school_details LIMIT 1))
ON CONFLICT (class_name, section, academic_year) DO NOTHING;

-- 3. Create sample teachers (adjust the school_id if needed)
INSERT INTO teachers (name, qualification, age, salary_type, salary_amount, is_class_teacher, school_id)
VALUES 
  ('Mr. John Smith', 'M.Ed', 35, 'monthly', 50000, true, (SELECT id FROM school_details LIMIT 1)),
  ('Ms. Mary Johnson', 'M.Sc Mathematics', 30, 'monthly', 45000, false, (SELECT id FROM school_details LIMIT 1))
ON CONFLICT DO NOTHING;

-- 4. Update the first teacher to be assigned to the class
UPDATE teachers 
SET assigned_class_id = (SELECT id FROM classes WHERE class_name = '10th' AND section = 'A' LIMIT 1)
WHERE is_class_teacher = true 
AND assigned_class_id IS NULL;

-- 5. Update the class to have a class teacher
UPDATE classes 
SET class_teacher_id = (SELECT id FROM teachers WHERE is_class_teacher = true LIMIT 1)
WHERE class_name = '10th' AND section = 'A' AND class_teacher_id IS NULL;

-- 6. Create sample subjects for the class
INSERT INTO subjects (name, class_id, academic_year)
SELECT s.subject_name, c.id, '2024-25'
FROM (VALUES 
  ('Mathematics'),
  ('English'), 
  ('Science'),
  ('Social Studies')
) AS s(subject_name)
CROSS JOIN (SELECT id FROM classes WHERE class_name = '10th' AND section = 'A' LIMIT 1) c
ON CONFLICT DO NOTHING;

-- 7. Create a sample student
INSERT INTO students (admission_no, name, dob, gender, academic_year, roll_no, class_id, school_id)
VALUES (
  'STD001',
  'Alice Johnson', 
  '2008-05-15', 
  'Female', 
  '2024-25', 
  1, 
  (SELECT id FROM classes WHERE class_name = '10th' AND section = 'A' LIMIT 1),
  (SELECT id FROM school_details LIMIT 1)
) ON CONFLICT (admission_no) DO NOTHING;

-- 8. Link existing parent user to the student
UPDATE users 
SET linked_parent_of = (SELECT id FROM students WHERE admission_no = 'STD001' LIMIT 1)
WHERE linked_parent_of IS NULL 
AND full_name LIKE '%Parent%' 
LIMIT 1;

-- 9. Create user accounts for teachers who don't have them
INSERT INTO users (email, full_name, role_id, linked_teacher_id, password)
SELECT 
  LOWER(REPLACE(t.name, ' ', '')) || '@school.edu',
  t.name,
  2, -- Assuming 2 is teacher role
  t.id,
  'password123'
FROM teachers t
LEFT JOIN users u ON u.linked_teacher_id = t.id
WHERE u.id IS NULL;

-- 10. Create teacher-subject assignments
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT t.id, s.id
FROM teachers t
CROSS JOIN subjects s
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_subjects ts 
  WHERE ts.teacher_id = t.id AND ts.subject_id = s.id
)
AND s.class_id = (SELECT id FROM classes WHERE class_name = '10th' AND section = 'A' LIMIT 1)
LIMIT 6; -- Limit to avoid too many assignments

-- Verification queries (uncomment to run):
-- SELECT 'Classes:', c.* FROM classes c;
-- SELECT 'Teachers:', t.* FROM teachers t;
-- SELECT 'Subjects:', s.* FROM subjects s;
-- SELECT 'Students:', st.* FROM students st;
-- SELECT 'Parent Users:', u.* FROM users u WHERE linked_parent_of IS NOT NULL;
-- SELECT 'Teacher Users:', u.* FROM users u WHERE linked_teacher_id IS NOT NULL;
-- SELECT 'Teacher-Subject Assignments:', ts.*, t.name as teacher_name, s.name as subject_name 
-- FROM teacher_subjects ts 
-- JOIN teachers t ON t.id = ts.teacher_id 
-- JOIN subjects s ON s.id = ts.subject_id;
