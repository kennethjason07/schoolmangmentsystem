-- Fix RLS policies to allow access to existing data
-- This script only fixes permissions, does not add any data

-- 1. Enable RLS on fee management tables (if not already enabled)
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_discounts ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on teacher management tables (if not already enabled)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "tenant_classes_policy" ON classes;
DROP POLICY IF EXISTS "tenant_students_policy" ON students;
DROP POLICY IF EXISTS "tenant_fee_structure_policy" ON fee_structure;
DROP POLICY IF EXISTS "tenant_student_fees_policy" ON student_fees;
DROP POLICY IF EXISTS "tenant_student_discounts_policy" ON student_discounts;
DROP POLICY IF EXISTS "tenant_teachers_policy" ON teachers;
DROP POLICY IF EXISTS "tenant_teacher_subjects_policy" ON teacher_subjects;
DROP POLICY IF EXISTS "tenant_teacher_attendance_policy" ON teacher_attendance;

-- 3. Create RLS policies for fee management tables
CREATE POLICY "tenant_classes_policy" ON classes
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_students_policy" ON students
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_fee_structure_policy" ON fee_structure
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_student_fees_policy" ON student_fees
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_student_discounts_policy" ON student_discounts
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

-- 4. Create RLS policies for teacher management tables
CREATE POLICY "tenant_teachers_policy" ON teachers
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_teacher_subjects_policy" ON teacher_subjects
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

CREATE POLICY "tenant_teacher_attendance_policy" ON teacher_attendance
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
    );

-- 5. Verify existing policies for related tables (subjects, timetable_entries, tasks)
-- These might already have policies, just checking they exist

-- Check if subjects table needs RLS policy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'subjects' AND column_name = 'tenant_id') THEN
        
        ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tenant_subjects_policy" ON subjects;
        CREATE POLICY "tenant_subjects_policy" ON subjects
            FOR ALL
            USING (
                tenant_id::text = COALESCE(
                    auth.jwt()->>'tenant_id',
                    (SELECT tenant_id::text FROM users WHERE id = auth.uid())
                )
            );
    END IF;
END $$;

-- Check if tasks table exists and needs RLS policy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') 
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'tenant_id') THEN
        
        ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tenant_tasks_policy" ON tasks;
        CREATE POLICY "tenant_tasks_policy" ON tasks
            FOR ALL
            USING (
                tenant_id::text = COALESCE(
                    auth.jwt()->>'tenant_id',
                    (SELECT tenant_id::text FROM users WHERE id = auth.uid())
                )
            );
    END IF;
END $$;

-- Check if timetable_entries table exists and needs RLS policy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'timetable_entries') 
       AND EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'timetable_entries' AND column_name = 'tenant_id') THEN
        
        ALTER TABLE timetable_entries ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "tenant_timetable_entries_policy" ON timetable_entries;
        CREATE POLICY "tenant_timetable_entries_policy" ON timetable_entries
            FOR ALL
            USING (
                tenant_id::text = COALESCE(
                    auth.jwt()->>'tenant_id',
                    (SELECT tenant_id::text FROM users WHERE id = auth.uid())
                )
            );
    END IF;
END $$;

-- 6. Verification queries (optional - run these to check your existing data)
-- Uncomment these if you want to see what data exists for your tenant

/*
-- Check existing data counts (replace 'your-tenant-id' with actual tenant ID)
SELECT 'classes' as table_name, COUNT(*) as record_count 
FROM classes WHERE tenant_id = 'your-tenant-id'
UNION ALL
SELECT 'students', COUNT(*) FROM students WHERE tenant_id = 'your-tenant-id'
UNION ALL
SELECT 'teachers', COUNT(*) FROM teachers WHERE tenant_id = 'your-tenant-id'
UNION ALL
SELECT 'fee_structure', COUNT(*) FROM fee_structure WHERE tenant_id = 'your-tenant-id'
UNION ALL
SELECT 'student_fees', COUNT(*) FROM student_fees WHERE tenant_id = 'your-tenant-id'
UNION ALL
SELECT 'subjects', COUNT(*) FROM subjects WHERE tenant_id = 'your-tenant-id';
*/

-- Success message
SELECT 'RLS policies have been applied successfully! Your existing data should now be accessible.' as status;
