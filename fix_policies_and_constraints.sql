-- ================================================================
-- STEP 1: CHECK CURRENT CONSTRAINTS (Run this first)
-- ================================================================

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
-- STEP 2: CLEAN UP CONFLICTING RLS POLICIES
-- ================================================================

-- Remove all conflicting policies for student_attendance
DROP POLICY IF EXISTS "student_attendance_tenant_access" ON student_attendance;
DROP POLICY IF EXISTS "student_attendance_tenant_all" ON student_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_insert" ON student_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_select" ON student_attendance;
DROP POLICY IF EXISTS "tenant_student_attendance_update" ON student_attendance;

-- Remove all conflicting policies for teacher_attendance
DROP POLICY IF EXISTS "teacher_attendance_tenant_all" ON teacher_attendance;
DROP POLICY IF EXISTS "teacher_attendance_tenant_isolation" ON teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_insert" ON teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_policy" ON teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_select" ON teacher_attendance;
DROP POLICY IF EXISTS "tenant_teacher_attendance_update" ON teacher_attendance;

-- ================================================================
-- STEP 3: CREATE SIMPLE, CONSISTENT RLS POLICIES
-- ================================================================

-- Create single, consistent policy for student_attendance
-- This assumes tenant_id should match the authenticated user's ID
CREATE POLICY "student_attendance_tenant_policy" 
ON student_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- Create single, consistent policy for teacher_attendance
CREATE POLICY "teacher_attendance_tenant_policy" 
ON teacher_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- ================================================================
-- STEP 4: FIX CONSTRAINTS (based on what you find in Step 1)
-- ================================================================

-- Example constraint drops - use the actual constraint names from Step 1
-- ALTER TABLE student_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;
-- ALTER TABLE teacher_attendance DROP CONSTRAINT IF EXISTS unique_attendance_per_day;

-- Add proper constraints that include tenant_id
-- ALTER TABLE student_attendance 
-- ADD CONSTRAINT unique_student_attendance_per_tenant_day 
-- UNIQUE (student_id, class_id, date, tenant_id);

-- ALTER TABLE teacher_attendance 
-- ADD CONSTRAINT unique_teacher_attendance_per_tenant_day 
-- UNIQUE (teacher_id, date, tenant_id);

-- ================================================================
-- STEP 5: VERIFICATION
-- ================================================================

-- Verify policies are clean
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('student_attendance', 'teacher_attendance')
ORDER BY tablename, policyname;

-- Verify constraints
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
