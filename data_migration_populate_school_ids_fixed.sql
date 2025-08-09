-- Data Migration Script: Populate school_id for existing records
-- This script should be run AFTER the database_migration_multi_school.sql
-- WARNING: Backup your database before running this script

-- Step 1: Get the default school ID (or create one if it doesn't exist)
DO $$
DECLARE
    default_school_id uuid;
BEGIN
    -- Try to get existing school
    SELECT id INTO default_school_id 
    FROM public.school_details 
    WHERE school_code = 'SCH001' OR name = 'Default School'
    LIMIT 1;
    
    -- If no school exists, create one
    IF default_school_id IS NULL THEN
        INSERT INTO public.school_details (
            name, 
            type, 
            school_code, 
            current_academic_year,
            is_active,
            created_at
        ) VALUES (
            'Default School', 
            'School', 
            'SCH001', 
            '2024-2025',
            true,
            CURRENT_TIMESTAMP
        ) RETURNING id INTO default_school_id;
    END IF;
    
    -- Update all existing records to use the default school
    RAISE NOTICE 'Using default school ID: %', default_school_id;
    
    -- Update users table
    UPDATE public.users 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update teachers table
    UPDATE public.teachers 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update students table
    UPDATE public.students 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update classes table
    UPDATE public.classes 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update subjects table
    UPDATE public.subjects 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update parents table
    UPDATE public.parents 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update exams table
    UPDATE public.exams 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update assignments table
    UPDATE public.assignments 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update homeworks table
    UPDATE public.homeworks 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update notifications table
    UPDATE public.notifications 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update tasks table
    UPDATE public.tasks 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update fee_structure table
    UPDATE public.fee_structure 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update student_fees table
    UPDATE public.student_fees 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update student_attendance table
    UPDATE public.student_attendance 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update teacher_attendance table
    UPDATE public.teacher_attendance 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update marks table
    UPDATE public.marks 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update messages table
    UPDATE public.messages 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update timetable_entries table
    UPDATE public.timetable_entries 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    -- Update personal_tasks table
    UPDATE public.personal_tasks 
    SET school_id = default_school_id 
    WHERE school_id IS NULL;
    
    RAISE NOTICE 'Successfully updated all tables with default school_id';
    
END $$;

-- Step 2: Populate school_users table with existing user relationships
DO $$
DECLARE
    default_school_id uuid;
    user_record RECORD;
    school_role text;
    user_count integer := 0;
BEGIN
    -- Get the default school ID
    SELECT id INTO default_school_id 
    FROM public.school_details 
    WHERE school_code = 'SCH001' OR name = 'Default School'
    LIMIT 1;
    
    -- Process all existing users
    FOR user_record IN 
        SELECT 
            u.id, 
            COALESCE(r.role_name, 'unknown') as role_name,
            u.linked_teacher_id,
            u.linked_student_id,
            u.linked_parent_of
        FROM public.users u
        LEFT JOIN public.roles r ON u.role_id = r.id
    LOOP
        -- Determine school role based on available information
        IF user_record.role_name IS NOT NULL AND user_record.role_name != 'unknown' THEN
            -- Use role from roles table
            CASE LOWER(user_record.role_name)
                WHEN 'admin' THEN school_role := 'Admin';
                WHEN 'teacher' THEN school_role := 'Teacher';
                WHEN 'student' THEN school_role := 'Student';
                WHEN 'parent' THEN school_role := 'Parent';
                ELSE school_role := 'Student'; -- default fallback
            END CASE;
        ELSIF user_record.linked_teacher_id IS NOT NULL THEN
            -- User is linked to a teacher record
            school_role := 'Teacher';
        ELSIF user_record.linked_student_id IS NOT NULL THEN
            -- User is linked to a student record
            school_role := 'Student';
        ELSIF user_record.linked_parent_of IS NOT NULL THEN
            -- User is linked as parent of a student
            school_role := 'Parent';
        ELSE
            -- No clear role, default to Student
            school_role := 'Student';
        END IF;
        
        -- Insert into school_users table
        INSERT INTO public.school_users (
            school_id, 
            user_id, 
            role_in_school, 
            is_primary_school
        ) VALUES (
            default_school_id,
            user_record.id,
            school_role,
            true
        ) ON CONFLICT (school_id, user_id) DO NOTHING;
        
        user_count := user_count + 1;
    END LOOP;
    
    RAISE NOTICE 'Populated school_users table with % users', user_count;
    
END $$;

-- Step 3: Ensure required roles exist in the database
DO $$
BEGIN
    -- Insert standard roles if they don't exist
    INSERT INTO public.roles (role_name) VALUES ('Admin') 
    ON CONFLICT (role_name) DO NOTHING;
    
    INSERT INTO public.roles (role_name) VALUES ('Teacher') 
    ON CONFLICT (role_name) DO NOTHING;
    
    INSERT INTO public.roles (role_name) VALUES ('Student') 
    ON CONFLICT (role_name) DO NOTHING;
    
    INSERT INTO public.roles (role_name) VALUES ('Parent') 
    ON CONFLICT (role_name) DO NOTHING;
    
    RAISE NOTICE 'Ensured all required roles exist';
    
END $$;

-- Step 4: Verification queries
-- Run these to verify the migration was successful

SELECT 'Users with school_id' as table_name, COUNT(*) as total_records, 
       COUNT(school_id) as records_with_school_id
FROM public.users
UNION ALL
SELECT 'Teachers with school_id', COUNT(*), COUNT(school_id)
FROM public.teachers
UNION ALL
SELECT 'Students with school_id', COUNT(*), COUNT(school_id)
FROM public.students
UNION ALL
SELECT 'Classes with school_id', COUNT(*), COUNT(school_id)
FROM public.classes
UNION ALL
SELECT 'Student attendance with school_id', COUNT(*), COUNT(school_id)
FROM public.student_attendance;

-- Check school_users table
SELECT 'School users created' as table_name, COUNT(*) as count
FROM public.school_users;

-- Check schools
SELECT 'Schools available' as table_name, COUNT(*) as count
FROM public.school_details;

-- Show role distribution in school_users
SELECT 
    'Role distribution' as info,
    role_in_school,
    COUNT(*) as user_count
FROM public.school_users
GROUP BY role_in_school
ORDER BY role_in_school;

-- Show users and their assigned school roles
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    r.role_name as original_role,
    su.role_in_school as school_role,
    sd.name as school_name
FROM public.users u
LEFT JOIN public.roles r ON u.role_id = r.id
LEFT JOIN public.school_users su ON u.id = su.user_id
LEFT JOIN public.school_details sd ON su.school_id = sd.id
ORDER BY u.email;

-- Step 5: Make school_id columns NOT NULL (ONLY run after verifying data migration is complete)
-- IMPORTANT: Uncomment these lines ONLY after confirming all records have school_id populated

/*
ALTER TABLE public.users ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.teachers ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.students ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.classes ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.subjects ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.parents ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.exams ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.assignments ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.homeworks ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.fee_structure ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.student_fees ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.student_attendance ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.teacher_attendance ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.marks ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.timetable_entries ALTER COLUMN school_id SET NOT NULL;
ALTER TABLE public.personal_tasks ALTER COLUMN school_id SET NOT NULL;
*/
