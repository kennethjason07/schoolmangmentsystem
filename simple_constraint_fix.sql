-- ================================================================
-- SIMPLE FIX FOR THE MAIN ISSUE
-- ================================================================

-- The root cause: teacher_attendance has a conflicting constraint
-- Drop the old constraint that doesn't include tenant_id
ALTER TABLE teacher_attendance DROP CONSTRAINT unique_teacher_attendance;

-- Verification: Check that we now only have the proper constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('student_attendance', 'teacher_attendance')
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name;
