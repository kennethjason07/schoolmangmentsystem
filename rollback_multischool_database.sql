-- ROLLBACK SCRIPT: Remove Multi-School Database Changes
-- WARNING: This will remove all multi-school related tables, columns, and policies
-- Please backup your database before running this script!

-- Step 1: Drop RLS policies that were created for multi-school
DROP POLICY IF EXISTS school_isolation_users ON public.users;
DROP POLICY IF EXISTS school_isolation_teachers ON public.teachers;
DROP POLICY IF EXISTS school_isolation_students ON public.students;
DROP POLICY IF EXISTS school_isolation_classes ON public.classes;
DROP POLICY IF EXISTS school_isolation_subjects ON public.subjects;
DROP POLICY IF EXISTS school_isolation_student_attendance ON public.student_attendance;
DROP POLICY IF EXISTS school_isolation_teacher_attendance ON public.teacher_attendance;
DROP POLICY IF EXISTS school_isolation_marks ON public.marks;
DROP POLICY IF EXISTS school_isolation_exams ON public.exams;
DROP POLICY IF EXISTS school_isolation_assignments ON public.assignments;
DROP POLICY IF EXISTS school_isolation_homeworks ON public.homeworks;
DROP POLICY IF EXISTS school_isolation_notifications ON public.notifications;
DROP POLICY IF EXISTS school_isolation_tasks ON public.tasks;
DROP POLICY IF EXISTS school_isolation_fee_structure ON public.fee_structure;
DROP POLICY IF EXISTS school_isolation_student_fees ON public.student_fees;
DROP POLICY IF EXISTS school_isolation_messages ON public.messages;
DROP POLICY IF EXISTS school_isolation_timetable_entries ON public.timetable_entries;
DROP POLICY IF EXISTS school_isolation_personal_tasks ON public.personal_tasks;
DROP POLICY IF EXISTS school_isolation_parents ON public.parents;

-- Also drop policies from the schools table created earlier
DROP POLICY IF EXISTS "Users can view schools they belong to" ON schools;
DROP POLICY IF EXISTS "Admins can manage their schools" ON schools;
DROP POLICY IF EXISTS "Users can view their school memberships" ON school_users;
DROP POLICY IF EXISTS "Admins can manage school memberships" ON school_users;

-- Step 2: Drop helper functions that were created for multi-school
DROP FUNCTION IF EXISTS get_user_school_ids(uuid);
DROP FUNCTION IF EXISTS get_user_primary_school(uuid);
DROP FUNCTION IF EXISTS switch_user_school(uuid, uuid);

-- Step 3: Disable RLS on tables (if they were enabled for multi-school)
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.teacher_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.marks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.homeworks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_structure DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.timetable_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.personal_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.parents DISABLE ROW LEVEL SECURITY;

-- Step 4: Drop indexes created for multi-school
DROP INDEX IF EXISTS idx_users_school_id;
DROP INDEX IF EXISTS idx_teachers_school_id;
DROP INDEX IF EXISTS idx_students_school_id;
DROP INDEX IF EXISTS idx_classes_school_id;
DROP INDEX IF EXISTS idx_subjects_school_id;
DROP INDEX IF EXISTS idx_student_attendance_school_id;
DROP INDEX IF EXISTS idx_teacher_attendance_school_id;
DROP INDEX IF EXISTS idx_school_users_school_id;
DROP INDEX IF EXISTS idx_school_users_user_id;
DROP INDEX IF EXISTS idx_schools_active;
DROP INDEX IF EXISTS idx_schools_code;
DROP INDEX IF EXISTS idx_school_users_user_id;
DROP INDEX IF EXISTS idx_school_users_primary;

-- Step 5: Drop foreign key constraints for school_id columns
ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_school_id_fkey;
ALTER TABLE IF EXISTS public.teachers DROP CONSTRAINT IF EXISTS teachers_school_id_fkey;
ALTER TABLE IF EXISTS public.students DROP CONSTRAINT IF EXISTS students_school_id_fkey;
ALTER TABLE IF EXISTS public.classes DROP CONSTRAINT IF EXISTS classes_school_id_fkey;
ALTER TABLE IF EXISTS public.subjects DROP CONSTRAINT IF EXISTS subjects_school_id_fkey;
ALTER TABLE IF EXISTS public.parents DROP CONSTRAINT IF EXISTS parents_school_id_fkey;
ALTER TABLE IF EXISTS public.exams DROP CONSTRAINT IF EXISTS exams_school_id_fkey;
ALTER TABLE IF EXISTS public.assignments DROP CONSTRAINT IF EXISTS assignments_school_id_fkey;
ALTER TABLE IF EXISTS public.homeworks DROP CONSTRAINT IF EXISTS homeworks_school_id_fkey;
ALTER TABLE IF EXISTS public.notifications DROP CONSTRAINT IF EXISTS notifications_school_id_fkey;
ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS tasks_school_id_fkey;
ALTER TABLE IF EXISTS public.fee_structure DROP CONSTRAINT IF EXISTS fee_structure_school_id_fkey;
ALTER TABLE IF EXISTS public.student_fees DROP CONSTRAINT IF EXISTS student_fees_school_id_fkey;
ALTER TABLE IF EXISTS public.student_attendance DROP CONSTRAINT IF EXISTS student_attendance_school_id_fkey;
ALTER TABLE IF EXISTS public.teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_school_id_fkey;
ALTER TABLE IF EXISTS public.marks DROP CONSTRAINT IF EXISTS marks_school_id_fkey;
ALTER TABLE IF EXISTS public.messages DROP CONSTRAINT IF EXISTS messages_school_id_fkey;
ALTER TABLE IF EXISTS public.timetable_entries DROP CONSTRAINT IF EXISTS timetable_entries_school_id_fkey;
ALTER TABLE IF EXISTS public.personal_tasks DROP CONSTRAINT IF EXISTS personal_tasks_school_id_fkey;

-- Step 6: Remove school_id columns from all tables
ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.teachers DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.students DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.classes DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.subjects DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.parents DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.exams DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.assignments DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.homeworks DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.notifications DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.tasks DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.fee_structure DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.student_fees DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.student_attendance DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.teacher_attendance DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.marks DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.messages DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.timetable_entries DROP COLUMN IF EXISTS school_id;
ALTER TABLE IF EXISTS public.personal_tasks DROP COLUMN IF EXISTS school_id;

-- Step 7: Drop the school_users junction table
DROP TABLE IF EXISTS public.school_users;

-- Step 8: Drop the schools table (if it was created by multi-school implementation)
DROP TABLE IF EXISTS public.schools CASCADE;

-- Step 9: Remove additional columns added to school_details table
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS is_active;
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS timezone;
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS academic_year_format;
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS current_academic_year;
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS school_code;
ALTER TABLE IF EXISTS public.school_details DROP COLUMN IF EXISTS school_board;

-- Drop the unique constraint that was added
ALTER TABLE IF EXISTS public.school_details DROP CONSTRAINT IF EXISTS school_details_school_code_unique;

-- Step 10: Drop update triggers created for multi-school
DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
DROP TRIGGER IF EXISTS update_school_users_updated_at ON school_users;

-- Drop the trigger function if it was created specifically for multi-school
-- Note: Only drop if it was created for multi-school and not used elsewhere
-- DROP FUNCTION IF EXISTS update_updated_at_column();

-- Step 11: Remove any sample data that was inserted
DELETE FROM public.school_details WHERE name IN ('Maximus', 'Default School') AND type = 'Primary';

-- Step 12: Show completion status
SELECT 'Multi-school database changes have been rolled back successfully!' as status;

-- Step 13: Show remaining tables to verify cleanup
SELECT 
    table_name,
    column_name
FROM information_schema.columns 
WHERE column_name = 'school_id' 
AND table_schema = 'public'
ORDER BY table_name;

-- If the above query returns any results, there are still school_id columns that need manual cleanup
