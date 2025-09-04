-- RLS Policies for Teacher Management Tables
-- Run this in Supabase SQL Editor to enable teacher management functionality
-- This fixes the issue where admins can't fetch teacher data due to RLS policies

-- ========================================
-- STEP 1: Enable RLS on all teacher-related tables
-- ========================================

-- Enable Row Level Security on all teacher-related tables
ALTER TABLE IF EXISTS public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;

-- Note: users, classes, subjects, and timetable_entries may already have RLS enabled
-- but we'll ensure they have proper policies for teacher management

-- ========================================
-- STEP 2: Teachers Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS teachers_select ON public.teachers;
DROP POLICY IF EXISTS teachers_insert ON public.teachers;
DROP POLICY IF EXISTS teachers_update ON public.teachers;
DROP POLICY IF EXISTS teachers_delete ON public.teachers;

-- Allow authenticated users to access teachers within their tenant
CREATE POLICY teachers_select ON public.teachers 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teachers.tenant_id)
);

CREATE POLICY teachers_insert ON public.teachers 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teachers.tenant_id)
);

CREATE POLICY teachers_update ON public.teachers 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teachers.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teachers.tenant_id)
);

CREATE POLICY teachers_delete ON public.teachers 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teachers.tenant_id)
);

-- ========================================
-- STEP 3: Teacher Subjects Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS teacher_subjects_select ON public.teacher_subjects;
DROP POLICY IF EXISTS teacher_subjects_insert ON public.teacher_subjects;
DROP POLICY IF EXISTS teacher_subjects_update ON public.teacher_subjects;
DROP POLICY IF EXISTS teacher_subjects_delete ON public.teacher_subjects;

-- Allow authenticated users to access teacher subjects within their tenant
CREATE POLICY teacher_subjects_select ON public.teacher_subjects 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_subjects.tenant_id)
);

CREATE POLICY teacher_subjects_insert ON public.teacher_subjects 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_subjects.tenant_id)
);

CREATE POLICY teacher_subjects_update ON public.teacher_subjects 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_subjects.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_subjects.tenant_id)
);

CREATE POLICY teacher_subjects_delete ON public.teacher_subjects 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_subjects.tenant_id)
);

-- ========================================
-- STEP 4: Teacher Attendance Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS teacher_attendance_select ON public.teacher_attendance;
DROP POLICY IF EXISTS teacher_attendance_insert ON public.teacher_attendance;
DROP POLICY IF EXISTS teacher_attendance_update ON public.teacher_attendance;
DROP POLICY IF EXISTS teacher_attendance_delete ON public.teacher_attendance;

-- Allow authenticated users to access teacher attendance within their tenant
CREATE POLICY teacher_attendance_select ON public.teacher_attendance 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_attendance.tenant_id)
);

CREATE POLICY teacher_attendance_insert ON public.teacher_attendance 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_attendance.tenant_id)
);

CREATE POLICY teacher_attendance_update ON public.teacher_attendance 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_attendance.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_attendance.tenant_id)
);

CREATE POLICY teacher_attendance_delete ON public.teacher_attendance 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = teacher_attendance.tenant_id)
);

-- ========================================
-- STEP 5: Tasks Table RLS Policies (if exists)
-- ========================================

-- Check if tasks table exists and has tenant_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'tasks'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'tenant_id'
    ) THEN
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS tasks_select ON public.tasks;
        DROP POLICY IF EXISTS tasks_insert ON public.tasks;
        DROP POLICY IF EXISTS tasks_update ON public.tasks;
        DROP POLICY IF EXISTS tasks_delete ON public.tasks;

        -- Create new policies
        EXECUTE 'CREATE POLICY tasks_select ON public.tasks 
        FOR SELECT TO authenticated 
        USING (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = tasks.tenant_id)
        )';

        EXECUTE 'CREATE POLICY tasks_insert ON public.tasks 
        FOR INSERT TO authenticated 
        WITH CHECK (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = tasks.tenant_id)
        )';

        EXECUTE 'CREATE POLICY tasks_update ON public.tasks 
        FOR UPDATE TO authenticated 
        USING (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = tasks.tenant_id)
        ) 
        WITH CHECK (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = tasks.tenant_id)
        )';

        EXECUTE 'CREATE POLICY tasks_delete ON public.tasks 
        FOR DELETE TO authenticated 
        USING (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = tasks.tenant_id)
        )';

        RAISE NOTICE '✅ Tasks table RLS policies created successfully!';
    ELSE
        RAISE NOTICE 'ℹ️ Tasks table does not exist or lacks tenant_id column, skipping...';
    END IF;
END $$;

-- ========================================
-- STEP 6: Ensure Subjects Table has proper RLS policies (if not already covered)
-- ========================================

-- The subjects table might already have RLS from fix_subjects_timetable_rls.sql
-- But let's make sure it's accessible for teacher management

-- Check current subjects policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'subjects' 
        AND policyname = 'subjects_select'
    ) THEN
        -- Create subjects RLS policies if they don't exist
        DROP POLICY IF EXISTS subjects_select_teacher_mgmt ON public.subjects;
        DROP POLICY IF EXISTS subjects_insert_teacher_mgmt ON public.subjects;
        DROP POLICY IF EXISTS subjects_update_teacher_mgmt ON public.subjects;
        DROP POLICY IF EXISTS subjects_delete_teacher_mgmt ON public.subjects;

        EXECUTE 'CREATE POLICY subjects_select_teacher_mgmt ON public.subjects 
        FOR SELECT TO authenticated 
        USING (
            (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
            OR 
            EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = subjects.tenant_id)
        )';

        RAISE NOTICE '✅ Additional subjects RLS policies created for teacher management!';
    ELSE
        RAISE NOTICE 'ℹ️ Subjects table already has RLS policies, skipping...';
    END IF;
END $$;

-- ========================================
-- STEP 7: Check and update Timetable Entries RLS (if exists)
-- ========================================

-- Check if timetable_entries table exists and has tenant_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'timetable_entries'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'timetable_entries' AND column_name = 'tenant_id'
    ) THEN
        
        -- Check if timetable policies already exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = 'timetable_entries' 
            AND policyname = 'timetable_entries_select'
        ) THEN
            -- Create timetable RLS policies if they don't exist
            EXECUTE 'CREATE POLICY timetable_entries_select_teacher_mgmt ON public.timetable_entries 
            FOR SELECT TO authenticated 
            USING (
                (auth.jwt() ? ''tenant_id'' AND (auth.jwt()->>''tenant_id'')::uuid = tenant_id) 
                OR 
                EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = timetable_entries.tenant_id)
            )';

            RAISE NOTICE '✅ Additional timetable entries RLS policies created for teacher management!';
        ELSE
            RAISE NOTICE 'ℹ️ Timetable entries already has RLS policies, skipping...';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Timetable entries table does not exist or lacks tenant_id column, skipping...';
    END IF;
END $$;

-- ========================================
-- STEP 8: Verify the setup
-- ========================================

-- Check which tables have RLS enabled
SELECT 'RLS Status for Teacher Management Tables:' as info;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('teachers', 'teacher_subjects', 'teacher_attendance', 'tasks', 'subjects', 'classes', 'users', 'timetable_entries')
AND schemaname = 'public'
ORDER BY tablename;

-- Show all RLS policies for teacher management tables
SELECT 'Teacher Management RLS Policies:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    SUBSTRING(qual, 1, 100) as condition_preview
FROM pg_policies 
WHERE tablename IN ('teachers', 'teacher_subjects', 'teacher_attendance', 'tasks', 'subjects', 'classes', 'users', 'timetable_entries')
ORDER BY tablename, policyname;

-- Test access to each table
SELECT 'Testing table access:' as info;

SELECT 'Teachers accessible:' as table_name, COUNT(*) as count 
FROM public.teachers
UNION ALL
SELECT 'Teacher Subjects accessible:', COUNT(*) 
FROM public.teacher_subjects
UNION ALL
SELECT 'Teacher Attendance accessible:', COUNT(*) 
FROM public.teacher_attendance
UNION ALL
SELECT 'Subjects accessible:', COUNT(*) 
FROM public.subjects
UNION ALL
SELECT 'Classes accessible:', COUNT(*) 
FROM public.classes
UNION ALL
SELECT 'Users accessible:', COUNT(*) 
FROM public.users;

-- Test Tasks table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        PERFORM 1; -- Just a dummy operation to execute the IF block
        -- Note: We can't run SELECT in a DO block, so this is just a structure check
        RAISE NOTICE 'Tasks table exists and should be accessible with RLS policies';
    ELSE
        RAISE NOTICE 'Tasks table does not exist';
    END IF;
END $$;

-- Test Timetable Entries table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable_entries') THEN
        RAISE NOTICE 'Timetable entries table exists and should be accessible with RLS policies';
    ELSE
        RAISE NOTICE 'Timetable entries table does not exist';
    END IF;
END $$;

-- Show success message
SELECT '✅ Teacher Management RLS policies created successfully!' as completion_message;
SELECT '🎉 Teacher Management should now work properly for all authenticated users!' as final_message;
SELECT '👨‍🏫 Admins can now access all teacher-related data within their tenant!' as tenant_message;
