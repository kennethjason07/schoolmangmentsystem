-- URGENT: Add missing unique constraint to student_attendance table
-- Run this IMMEDIATELY in your Supabase SQL Editor

-- Add the unique constraint that is missing
ALTER TABLE public.student_attendance 
ADD CONSTRAINT unique_student_attendance_per_day 
UNIQUE (student_id, date);

-- Verify it was created
SELECT 
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name = 'student_attendance'
GROUP BY tc.constraint_name;
