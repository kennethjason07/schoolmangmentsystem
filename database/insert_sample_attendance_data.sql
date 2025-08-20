-- Insert sample attendance data for testing AttendanceSummary.js
-- This script assumes you have existing students, classes, and users in your database

-- Sample data for current month (August 2024)
-- Replace the UUIDs with actual IDs from your database

-- First, let's insert some sample data assuming we have a student with ID
-- You'll need to replace these UUIDs with actual values from your database
DO $$
DECLARE
    sample_student_id uuid;
    sample_class_id uuid;
    sample_user_id uuid;
    current_date_val date;
    day_counter integer;
    status_val text;
BEGIN
    -- Try to get existing student, class, and user IDs
    -- If they don't exist, you'll need to create them first
    
    SELECT id INTO sample_student_id FROM students LIMIT 1;
    SELECT id INTO sample_class_id FROM classes LIMIT 1;
    SELECT id INTO sample_user_id FROM users WHERE role = 'teacher' LIMIT 1;
    
    -- If no data exists, use sample UUIDs (you'll need to create the referenced records first)
    IF sample_student_id IS NULL THEN
        sample_student_id := '550e8400-e29b-41d4-a716-446655440000'::uuid;
    END IF;
    
    IF sample_class_id IS NULL THEN
        sample_class_id := '550e8400-e29b-41d4-a716-446655440001'::uuid;
    END IF;
    
    IF sample_user_id IS NULL THEN
        sample_user_id := '550e8400-e29b-41d4-a716-446655440002'::uuid;
    END IF;
    
    -- Insert attendance data for the past 30 days (excluding Sundays)
    FOR day_counter IN 1..30 LOOP
        current_date_val := CURRENT_DATE - INTERVAL '30 days' + INTERVAL '1 day' * day_counter;
        
        -- Skip Sundays (day of week = 0)
        IF EXTRACT(DOW FROM current_date_val) != 0 THEN
            -- Generate realistic attendance pattern (90% present, 10% absent)
            IF RANDOM() < 0.9 THEN
                status_val := 'Present';
            ELSE
                status_val := 'Absent';
            END IF;
            
            -- Insert attendance record
            INSERT INTO public.student_attendance (
                student_id,
                class_id,
                date,
                status,
                marked_by,
                created_at
            ) VALUES (
                sample_student_id,
                sample_class_id,
                current_date_val,
                status_val,
                sample_user_id,
                current_date_val + TIME '09:00:00'
            ) ON CONFLICT (student_id, date) DO NOTHING;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Sample attendance data inserted successfully';
    RAISE NOTICE 'Student ID used: %', sample_student_id;
    RAISE NOTICE 'Class ID used: %', sample_class_id;
    RAISE NOTICE 'Marked by User ID: %', sample_user_id;
END $$;

-- Verify the inserted data
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_count,
    COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_count,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM public.student_attendance;

-- Show sample records
SELECT 
    student_id,
    date,
    status,
    EXTRACT(DOW FROM date) as day_of_week,
    created_at
FROM public.student_attendance
ORDER BY date DESC
LIMIT 10;
