-- ================================================================
-- STEP 1: DIAGNOSTIC QUERIES - Run these first to understand the current state
-- ================================================================

-- Check current table structure
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('student_attendance', 'teacher_attendance')
ORDER BY table_name, ordinal_position;

-- Check existing unique constraints 
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
-- STEP 2: FIXES - Run these based on what you find above
-- ================================================================

-- Fix 1: Ensure tenant_id columns exist (run if missing)
ALTER TABLE student_attendance ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE teacher_attendance ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Fix 2: Drop problematic unique constraints that don't include tenant_id
-- This is likely the main issue - the constraint doesn't include tenant_id
ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day CASCADE;
ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day CASCADE;

-- Also check for other possible constraint names
ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS student_attendance_unique_per_day CASCADE;
ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_unique_per_day CASCADE;

-- Fix 3: Create proper unique constraints that include tenant_id
-- For student attendance - include all relevant fields for true uniqueness
ALTER TABLE student_attendance 
ADD CONSTRAINT unique_student_attendance_per_tenant_day 
UNIQUE (student_id, class_id, date, tenant_id);

-- For teacher attendance - include all relevant fields for true uniqueness  
ALTER TABLE teacher_attendance 
ADD CONSTRAINT unique_teacher_attendance_per_tenant_day 
UNIQUE (teacher_id, date, tenant_id);

-- Fix 4: Create proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_lookup 
ON student_attendance(tenant_id, class_id, date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_tenant_lookup 
ON teacher_attendance(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_student_attendance_student_lookup 
ON student_attendance(student_id, date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_lookup 
ON teacher_attendance(teacher_id, date);

-- Fix 5: Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can manage student attendance for their tenant" ON student_attendance;
DROP POLICY IF EXISTS "Users can view student attendance for their tenant" ON student_attendance;
DROP POLICY IF EXISTS "Users can read student attendance for their tenant" ON student_attendance;
DROP POLICY IF EXISTS "Users can insert student attendance for their tenant" ON student_attendance;
DROP POLICY IF EXISTS "Users can update student attendance for their tenant" ON student_attendance;
DROP POLICY IF EXISTS "Users can delete student attendance for their tenant" ON student_attendance;

DROP POLICY IF EXISTS "Users can manage teacher attendance for their tenant" ON teacher_attendance;
DROP POLICY IF EXISTS "Users can view teacher attendance for their tenant" ON teacher_attendance;
DROP POLICY IF EXISTS "Users can read teacher attendance for their tenant" ON teacher_attendance;
DROP POLICY IF EXISTS "Users can insert teacher attendance for their tenant" ON teacher_attendance;
DROP POLICY IF EXISTS "Users can update teacher attendance for their tenant" ON teacher_attendance;
DROP POLICY IF EXISTS "Users can delete teacher attendance for their tenant" ON teacher_attendance;

-- Fix 6: Create comprehensive RLS policies for student_attendance
CREATE POLICY "student_attendance_tenant_all" 
ON student_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- Fix 7: Create comprehensive RLS policies for teacher_attendance
CREATE POLICY "teacher_attendance_tenant_all" 
ON teacher_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- ================================================================
-- STEP 3: VERIFICATION QUERIES - Run these to verify fixes
-- ================================================================

-- Verify new constraints
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

-- Verify new policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('student_attendance', 'teacher_attendance');

-- Check that tenant_id columns exist
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('student_attendance', 'teacher_attendance')
  AND column_name = 'tenant_id'
ORDER BY table_name;
