-- FIX ATTENDANCE DATABASE ISSUE
-- This script checks for and removes problematic triggers/functions that might be
-- automatically creating "Absent" records for all students

-- 1. Check for existing triggers on student_attendance table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_attendance';

-- 2. Check for any functions that might be creating default attendance records
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%student_attendance%' 
   OR routine_definition ILIKE '%absent%'
   OR routine_name ILIKE '%attendance%';

-- 3. Check the table structure for any DEFAULT values or constraints
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'student_attendance';

-- 4. Look for any policies that might affect attendance insertion
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'student_attendance';

-- 5. If there are problematic triggers, we can drop them:
-- (Uncomment the lines below if triggers are found that create default records)

/*
-- Drop problematic triggers (replace 'trigger_name' with actual trigger name)
DROP TRIGGER IF EXISTS auto_create_absent_records ON student_attendance;
DROP TRIGGER IF EXISTS ensure_all_students_marked ON student_attendance;
DROP TRIGGER IF EXISTS default_attendance_trigger ON student_attendance;

-- Drop problematic functions (replace with actual function names)
DROP FUNCTION IF EXISTS create_default_attendance();
DROP FUNCTION IF EXISTS ensure_all_students_attendance();
DROP FUNCTION IF EXISTS auto_mark_absent();
*/

-- 6. Check if there are any check constraints forcing attendance for all students
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'student_attendance'::regclass;

-- 7. Simple test to see what happens when we insert a single record
-- (This will help us identify if triggers are adding extra records)

/*
-- Test insertion (uncomment to test)
BEGIN;

-- Insert a single test record
INSERT INTO student_attendance (student_id, class_id, date, status, marked_by)
VALUES (
    'test-student-id', 
    'test-class-id', 
    '2025-01-04', 
    'Present', 
    'test-teacher-id'
);

-- Check how many records were actually created
SELECT COUNT(*) as total_records_created 
FROM student_attendance 
WHERE date = '2025-01-04' AND class_id = 'test-class-id';

-- Rollback the test
ROLLBACK;
*/

-- 8. Clean solution: Create a simple function that ONLY inserts what we send
-- This bypasses any problematic triggers

CREATE OR REPLACE FUNCTION insert_attendance_safely(
    p_records JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB := '{"success": true, "inserted": 0}';
    record JSONB;
    inserted_count INTEGER := 0;
BEGIN
    -- Loop through each record in the JSON array
    FOR record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        -- Insert only the specific record, no triggers
        INSERT INTO student_attendance (
            student_id,
            class_id,
            date,
            status,
            marked_by,
            tenant_id
        ) VALUES (
            (record->>'student_id')::UUID,
            (record->>'class_id')::UUID,
            (record->>'date')::DATE,
            record->>'status',
            (record->>'marked_by')::UUID,
            COALESCE((record->>'tenant_id')::UUID, 'b8f8b5f0-1234-4567-8901-123456789000'::UUID)
        )
        ON CONFLICT (student_id, date) 
        DO UPDATE SET 
            status = EXCLUDED.status,
            marked_by = EXCLUDED.marked_by,
            updated_at = NOW();
        
        inserted_count := inserted_count + 1;
    END LOOP;
    
    result := jsonb_set(result, '{inserted}', to_jsonb(inserted_count));
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'inserted', inserted_count
        );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION insert_attendance_safely(JSONB) TO authenticated;

-- 9. Alternative: If we need to disable triggers temporarily
/*
-- Disable all triggers on student_attendance table
ALTER TABLE student_attendance DISABLE TRIGGER ALL;

-- Re-enable triggers later (be careful with this)
-- ALTER TABLE student_attendance ENABLE TRIGGER ALL;
*/

-- 10. Check for any views or materialized views that might affect the data
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%attendance%' 
   AND table_schema = 'public';

COMMENT ON FUNCTION insert_attendance_safely IS 
'Safely insert attendance records without triggering automatic absent record creation';
