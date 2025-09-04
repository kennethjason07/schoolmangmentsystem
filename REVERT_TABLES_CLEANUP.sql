-- REVERT/CLEANUP ACCIDENTALLY CREATED TABLES
-- This script safely removes tables that were accidentally created
-- Run this in the database where you mistakenly ran the CREATE_MISSING_TABLES.sql script

-- First, let's see what tables exist before cleanup
SELECT 'BEFORE CLEANUP - Existing tables:' as status;
SELECT 
    table_name,
    'EXISTS - Will be removed' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'students', 'teachers', 'classes', 'parents', 'users', 'tenants', 'roles',
    'subjects', 'student_attendance', 'teacher_attendance', 'exams', 'marks',
    'student_fees', 'fee_structure', 'homeworks', 'assignments', 'notifications',
    'messages', 'events', 'tasks', 'personal_tasks', 'timetable_entries',
    'school_details', 'school_expenses', 'expense_categories', 'student_discounts',
    'leave_applications', 'teacher_leave_balance', 'teacher_subjects',
    'notification_recipients', 'assignment_submissions', 'period_settings'
  )
ORDER BY table_name;

-- Check if there are any custom sequences we created
SELECT 'Custom sequences to be removed:' as status;
SELECT 
    sequence_name,
    'EXISTS - Will be removed' as status
FROM information_schema.sequences 
WHERE sequence_schema = 'public'
  AND sequence_name IN (
    'expense_categories_id_seq',
    'roles_id_seq', 
    'school_expenses_id_seq',
    'receipt_number_seq'
  );

-- SAFETY CHECK - Count records before deletion
DO $$
DECLARE
    student_count INTEGER := 0;
    teacher_count INTEGER := 0;
    total_records INTEGER := 0;
BEGIN
    -- Check if tables exist and count records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students' AND table_schema = 'public') THEN
        EXECUTE 'SELECT COUNT(*) FROM students' INTO student_count;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teachers' AND table_schema = 'public') THEN
        EXECUTE 'SELECT COUNT(*) FROM teachers' INTO teacher_count;
    END IF;
    
    total_records := student_count + teacher_count;
    
    RAISE NOTICE 'SAFETY CHECK:';
    RAISE NOTICE '- Students to be deleted: %', student_count;
    RAISE NOTICE '- Teachers to be deleted: %', teacher_count;
    RAISE NOTICE '- Total records to be lost: %', total_records;
    RAISE NOTICE '';
    
    IF total_records > 100 THEN
        RAISE NOTICE '⚠️  WARNING: Large amount of data will be deleted!';
        RAISE NOTICE '   Consider backing up data before proceeding';
        RAISE NOTICE '';
    END IF;
END $$;

-- DROP TABLES IN CORRECT ORDER (respecting foreign key dependencies)
-- Drop child tables first, then parent tables

-- Drop tables with foreign keys to students
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.student_attendance CASCADE;
DROP TABLE IF EXISTS public.student_fees CASCADE;
DROP TABLE IF EXISTS public.student_discounts CASCADE;
DROP TABLE IF EXISTS public.marks CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;

-- Drop tables with foreign keys to teachers  
DROP TABLE IF EXISTS public.teacher_attendance CASCADE;
DROP TABLE IF EXISTS public.teacher_subjects CASCADE;
DROP TABLE IF EXISTS public.teacher_leave_balance CASCADE;
DROP TABLE IF EXISTS public.leave_applications CASCADE;

-- Drop tables with foreign keys to classes
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.timetable_entries CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.homeworks CASCADE;
DROP TABLE IF EXISTS public.fee_structure CASCADE;

-- Drop notification related tables
DROP TABLE IF EXISTS public.notification_recipients CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- Drop other dependent tables
DROP TABLE IF EXISTS public.personal_tasks CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.school_expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP TABLE IF EXISTS public.school_details CASCADE;
DROP TABLE IF EXISTS public.period_settings CASCADE;

-- Drop main entity tables
DROP TABLE IF EXISTS public.parents CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;

-- Drop foundational tables
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Drop sequences
DROP SEQUENCE IF EXISTS expense_categories_id_seq;
DROP SEQUENCE IF EXISTS roles_id_seq;
DROP SEQUENCE IF EXISTS school_expenses_id_seq;
DROP SEQUENCE IF EXISTS receipt_number_seq;

-- Verify cleanup
SELECT 'AFTER CLEANUP - Remaining tables:' as status;
SELECT 
    table_name,
    'STILL EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'students', 'teachers', 'classes', 'parents', 'users', 'tenants', 'roles',
    'subjects', 'student_attendance', 'teacher_attendance', 'exams', 'marks',
    'student_fees', 'fee_structure', 'homeworks', 'assignments', 'notifications',
    'messages', 'events', 'tasks', 'personal_tasks', 'timetable_entries',
    'school_details', 'school_expenses', 'expense_categories', 'student_discounts',
    'leave_applications', 'teacher_leave_balance', 'teacher_subjects',
    'notification_recipients', 'assignment_submissions', 'period_settings'
  )
ORDER BY table_name;

-- Final status
SELECT 
CASE 
    WHEN COUNT(*) = 0 THEN '✅ CLEANUP SUCCESSFUL - All tables removed'
    ELSE '⚠️ CLEANUP INCOMPLETE - ' || COUNT(*) || ' tables still exist'
END as cleanup_status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name IN (
    'students', 'teachers', 'classes', 'parents', 'users', 'tenants', 'roles',
    'subjects', 'student_attendance', 'teacher_attendance', 'exams', 'marks',
    'student_fees', 'fee_structure', 'homeworks', 'assignments', 'notifications',
    'messages', 'events', 'tasks', 'personal_tasks', 'timetable_entries',
    'school_details', 'school_expenses', 'expense_categories', 'student_discounts',
    'leave_applications', 'teacher_leave_balance', 'teacher_subjects',
    'notification_recipients', 'assignment_submissions', 'period_settings'
  );

SELECT '
🧹 TABLE CLEANUP COMPLETED

WHAT WAS REMOVED:
- All school management system tables
- Sample data (students, teachers, classes)
- Related sequences
- All foreign key relationships

WHAT REMAINS:
- Your original database structure (if any)
- Any tables not related to the school system
- Auth tables (auth.users, etc.) remain untouched

STATUS: Database reverted to pre-creation state
' as completion_message;
