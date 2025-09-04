-- ================================================================
-- FINAL FIX FOR ATTENDANCE CONSTRAINTS AND POLICIES
-- ================================================================

-- STEP 1: Fix the teacher_attendance constraint conflict
-- Drop the old constraint that doesn't include tenant_id (this is causing the issue)
ALTER TABLE teacher_attendance DROP CONSTRAINT unique_teacher_attendance;

-- STEP 2: Clean up conflicting RLS policies
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

-- STEP 3: Create single, consistent RLS policies
-- Use the same tenant validation method that your app is using
CREATE POLICY "student_attendance_tenant_policy" 
ON student_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "teacher_attendance_tenant_policy" 
ON teacher_attendance 
FOR ALL 
TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (tenant_id = auth.uid());

-- STEP 4: Verification queries
-- Check that we now have clean, proper constraints
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

-- Check that we have clean policies
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
