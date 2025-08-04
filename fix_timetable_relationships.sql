-- Fix timetable relationships and verify schema
-- Run this SQL in your Supabase SQL editor

-- 1. Verify timetable_entries table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'timetable_entries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verify foreign key constraints for timetable_entries
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
    AND tc.table_name = 'timetable_entries'
    AND tc.table_schema = 'public';

-- 3. Test the timetable relationship queries
-- This should work with the corrected structure
SELECT 
    te.id,
    te.class_id,
    te.subject_id,
    te.teacher_id,
    te.day_of_week,
    te.period_number,
    te.start_time,
    te.end_time,
    s.name as subject_name,
    t.name as teacher_name,
    c.class_name,
    c.section
FROM timetable_entries te
JOIN subjects s ON te.subject_id = s.id
JOIN teachers t ON te.teacher_id = t.id
JOIN classes c ON te.class_id = c.id
ORDER BY te.day_of_week, te.period_number
LIMIT 5;

-- 4. Check if we have any sample timetable data
SELECT COUNT(*) as timetable_count FROM timetable_entries;

-- 5. If you need to add sample timetable data for testing:
-- (Uncomment the following if you need test data)

/*
-- First, let's get some existing IDs to work with
DO $$
DECLARE
    sample_class_id uuid;
    sample_subject_id uuid;
    sample_teacher_id uuid;
BEGIN
    -- Get a sample class
    SELECT id INTO sample_class_id FROM classes LIMIT 1;
    
    -- Get a sample subject for that class
    SELECT id INTO sample_subject_id FROM subjects WHERE class_id = sample_class_id LIMIT 1;
    
    -- Get a sample teacher
    SELECT id INTO sample_teacher_id FROM teachers LIMIT 1;
    
    -- Insert sample timetable entries if we have the required data
    IF sample_class_id IS NOT NULL AND sample_subject_id IS NOT NULL AND sample_teacher_id IS NOT NULL THEN
        INSERT INTO timetable_entries (
            class_id,
            subject_id,
            teacher_id,
            day_of_week,
            period_number,
            start_time,
            end_time,
            academic_year
        ) VALUES 
        (sample_class_id, sample_subject_id, sample_teacher_id, 'Monday', 1, '09:00:00', '09:45:00', '2024-25'),
        (sample_class_id, sample_subject_id, sample_teacher_id, 'Tuesday', 1, '09:00:00', '09:45:00', '2024-25'),
        (sample_class_id, sample_subject_id, sample_teacher_id, 'Wednesday', 1, '09:00:00', '09:45:00', '2024-25')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Sample timetable entries created successfully';
    ELSE
        RAISE NOTICE 'Cannot create sample data - missing required classes, subjects, or teachers';
    END IF;
END $$;
*/

-- 6. Verify day_of_week values are correct
SELECT DISTINCT day_of_week FROM timetable_entries ORDER BY day_of_week;

-- 7. Check for any orphaned timetable entries
SELECT 
    te.id,
    te.class_id,
    te.subject_id,
    te.teacher_id,
    CASE WHEN c.id IS NULL THEN 'Missing Class' ELSE 'OK' END as class_status,
    CASE WHEN s.id IS NULL THEN 'Missing Subject' ELSE 'OK' END as subject_status,
    CASE WHEN t.id IS NULL THEN 'Missing Teacher' ELSE 'OK' END as teacher_status
FROM timetable_entries te
LEFT JOIN classes c ON te.class_id = c.id
LEFT JOIN subjects s ON te.subject_id = s.id
LEFT JOIN teachers t ON te.teacher_id = t.id
WHERE c.id IS NULL OR s.id IS NULL OR t.id IS NULL;
