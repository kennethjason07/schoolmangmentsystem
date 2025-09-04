-- Debug and Fix Attendance Schema and RLS Policies
-- Run this in your Supabase SQL editor to identify and fix issues

-- 1. Check current table structure and constraints
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('student_attendance', 'teacher_attendance')
ORDER BY table_name, ordinal_position;

-- 2. Check existing constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('student_attendance', 'teacher_attendance')
ORDER BY tc.table_name, tc.constraint_name;

-- 3. Check current RLS policies
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
WHERE tablename IN ('student_attendance', 'teacher_attendance');

-- 4. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename IN ('student_attendance', 'teacher_attendance');

-- ==============================================================
-- FIXES: Run the sections below based on what you find missing
-- ==============================================================

-- Fix 1: Ensure tables have proper structure with tenant_id
-- Only run if tenant_id column is missing

-- For student_attendance table:
-- ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id);
-- CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_id ON student_attendance(tenant_id);

-- For teacher_attendance table:
-- ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES auth.users(id);
-- CREATE INDEX IF NOT EXISTS idx_teacher_attendance_tenant_id ON teacher_attendance(tenant_id);

-- Fix 2: Update unique constraints to include tenant_id
-- Drop existing constraints and recreate with tenant_id

-- For student_attendance:
-- ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
-- ALTER TABLE student_attendance ADD CONSTRAINT unique_student_attendance_per_day 
--     UNIQUE (student_id, date, tenant_id, class_id);

-- For teacher_attendance:
-- ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
-- ALTER TABLE teacher_attendance ADD CONSTRAINT unique_teacher_attendance_per_day 
--     UNIQUE (teacher_id, date, tenant_id);

-- Fix 3: Enable RLS on both tables
-- ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;

-- Fix 4: Create RLS policies for student_attendance
-- Drop existing policies first
-- DROP POLICY IF EXISTS "Users can manage student attendance for their tenant" ON student_attendance;
-- DROP POLICY IF EXISTS "Users can view student attendance for their tenant" ON student_attendance;

-- Create new policies
-- CREATE POLICY "Users can manage student attendance for their tenant" 
-- ON student_attendance 
-- FOR ALL 
-- USING (tenant_id = auth.uid())
-- WITH CHECK (tenant_id = auth.uid());

-- Fix 5: Create RLS policies for teacher_attendance
-- Drop existing policies first
-- DROP POLICY IF EXISTS "Users can manage teacher attendance for their tenant" ON teacher_attendance;
-- DROP POLICY IF EXISTS "Users can view teacher attendance for their tenant" ON teacher_attendance;

-- Create new policies
-- CREATE POLICY "Users can manage teacher attendance for their tenant" 
-- ON teacher_attendance 
-- FOR ALL 
-- USING (tenant_id = auth.uid())
-- WITH CHECK (tenant_id = auth.uid());

-- Fix 6: Create indexes for better performance
-- CREATE INDEX IF NOT EXISTS idx_student_attendance_lookup 
--     ON student_attendance(tenant_id, class_id, date, student_id);
-- CREATE INDEX IF NOT EXISTS idx_teacher_attendance_lookup 
--     ON teacher_attendance(tenant_id, date, teacher_id);

-- ==============================================================
-- VERIFICATION QUERIES
-- ==============================================================

-- Verify the fixes worked:
-- SELECT 'student_attendance' as table_name, count(*) as row_count FROM student_attendance
-- UNION ALL 
-- SELECT 'teacher_attendance' as table_name, count(*) as row_count FROM teacher_attendance;

-- Check constraint names:
-- SELECT constraint_name, table_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name IN ('student_attendance', 'teacher_attendance') 
--   AND constraint_type = 'UNIQUE';
