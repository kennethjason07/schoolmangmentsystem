-- Fix teacher-subject-class relationships
-- Run this SQL in your Supabase SQL editor

-- Ensure foreign key constraints are properly set up
-- Check if the relationships exist and are correct

-- 1. Verify teacher_subjects table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'teacher_subjects' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verify foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'teacher_subjects'
    AND tc.table_schema = 'public';

-- 3. Test the relationship query that was failing
-- This should work now with the corrected query structure
SELECT 
    ts.id,
    ts.teacher_id,
    ts.subject_id,
    s.name as subject_name,
    s.class_id,
    c.class_name,
    c.section
FROM teacher_subjects ts
JOIN subjects s ON ts.subject_id = s.id
JOIN classes c ON s.class_id = c.id
LIMIT 5;

-- 4. If you need to add sample data for testing:
-- (Uncomment the following if you need test data)

/*
-- Insert sample teacher if not exists
INSERT INTO teachers (id, name, qualification, age, salary_type, salary_amount, address, is_class_teacher, assigned_class_id)
VALUES (gen_random_uuid(), 'Test Teacher', 'M.Ed', 30, 'monthly', 50000, 'Test Address', false, null)
ON CONFLICT DO NOTHING;

-- Insert sample class if not exists
INSERT INTO classes (id, class_name, section, academic_year)
VALUES (gen_random_uuid(), '10', 'A', '2024-25')
ON CONFLICT DO NOTHING;

-- Insert sample subject if not exists
INSERT INTO subjects (id, name, class_id, academic_year)
SELECT gen_random_uuid(), 'Mathematics', c.id, '2024-25'
FROM classes c
WHERE c.class_name = '10' AND c.section = 'A'
ON CONFLICT DO NOTHING;

-- Insert sample teacher-subject assignment
INSERT INTO teacher_subjects (teacher_id, subject_id)
SELECT t.id, s.id
FROM teachers t, subjects s, classes c
WHERE t.name = 'Test Teacher'
AND s.name = 'Mathematics'
AND s.class_id = c.id
AND c.class_name = '10'
AND c.section = 'A'
ON CONFLICT DO NOTHING;
*/
