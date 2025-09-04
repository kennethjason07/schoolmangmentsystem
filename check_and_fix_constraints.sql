-- ================================================================
-- CHECK CURRENT CONSTRAINTS
-- ================================================================

-- Check existing unique constraints to see what's causing the duplicate key issue
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

-- ================================================================
-- FIX THE CONSTRAINTS - Run the appropriate sections below
-- ================================================================

-- Fix for student_attendance table
-- Drop the problematic constraint (replace 'unique_attendance_per_day' with actual constraint name from above)
-- ALTER TABLE student_attendance DROP CONSTRAINT unique_attendance_per_day;

-- Create new proper constraint that includes tenant_id
-- ALTER TABLE student_attendance 
-- ADD CONSTRAINT unique_student_attendance_per_tenant_day 
-- UNIQUE (student_id, class_id, date, tenant_id);

-- Fix for teacher_attendance table  
-- Drop the problematic constraint (replace 'unique_attendance_per_day' with actual constraint name from above)
-- ALTER TABLE teacher_attendance DROP CONSTRAINT unique_attendance_per_day;

-- Create new proper constraint that includes tenant_id
-- ALTER TABLE teacher_attendance 
-- ADD CONSTRAINT unique_teacher_attendance_per_tenant_day 
-- UNIQUE (teacher_id, date, tenant_id);

-- ================================================================
-- CHECK RLS POLICIES
-- ================================================================

-- Check current RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('student_attendance', 'teacher_attendance');

-- ================================================================
-- COMMON CONSTRAINT NAMES TO TRY DROPPING
-- ================================================================

-- Try these one by one to drop the existing constraint:

-- Option 1: Most likely constraint names
-- ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
-- ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;

-- Option 2: Other possible names  
-- ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_pkey;
-- ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_pkey;

-- Option 3: Generated names
-- ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_student_id_class_id_date_key;
-- ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_date_key;

-- ================================================================
-- AFTER DROPPING, ADD NEW CONSTRAINTS
-- ================================================================

-- After successfully dropping the old constraints, add these:
-- ALTER TABLE student_attendance 
-- ADD CONSTRAINT unique_student_attendance_per_tenant_day 
-- UNIQUE (student_id, class_id, date, tenant_id);

-- ALTER TABLE teacher_attendance 
-- ADD CONSTRAINT unique_teacher_attendance_per_tenant_day 
-- UNIQUE (teacher_id, date, tenant_id);

-- ================================================================
-- CREATE PROPER RLS POLICIES
-- ================================================================

-- Drop any existing policies first
-- DROP POLICY IF EXISTS "Users can manage student attendance for their tenant" ON student_attendance;
-- DROP POLICY IF EXISTS "student_attendance_tenant_all" ON student_attendance;

-- DROP POLICY IF EXISTS "Users can manage teacher attendance for their tenant" ON teacher_attendance;  
-- DROP POLICY IF EXISTS "teacher_attendance_tenant_all" ON teacher_attendance;

-- Create new comprehensive policies
-- CREATE POLICY "student_attendance_tenant_policy" 
-- ON student_attendance 
-- FOR ALL 
-- TO authenticated
-- USING (tenant_id = auth.uid())
-- WITH CHECK (tenant_id = auth.uid());

-- CREATE POLICY "teacher_attendance_tenant_policy" 
-- ON teacher_attendance 
-- FOR ALL 
-- TO authenticated  
-- USING (tenant_id = auth.uid())
-- WITH CHECK (tenant_id = auth.uid());

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Run this after making changes to verify:
-- SELECT 
--     tc.table_name,
--     tc.constraint_name,
--     string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu 
--     ON tc.constraint_name = kcu.constraint_name
-- WHERE tc.table_name IN ('student_attendance', 'teacher_attendance')
--   AND tc.constraint_type = 'UNIQUE'
-- GROUP BY tc.table_name, tc.constraint_name
-- ORDER BY tc.table_name;
