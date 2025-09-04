-- Sample Data for Teacher Management Testing
-- Run this AFTER running fix_teacher_management_rls.sql
-- This creates basic teachers, their assignments, and related data for testing

-- ========================================
-- STEP 1: Create sample teachers
-- ========================================

-- Create teachers for the tenant (only if they don't exist)
DO $$
BEGIN
  -- Check if teachers exist for this tenant
  IF (SELECT COUNT(*) FROM public.teachers WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
    
    INSERT INTO public.teachers (
      name, 
      phone, 
      age, 
      address, 
      qualification, 
      salary_amount, 
      salary_type,
      is_class_teacher,
      tenant_id, 
      created_at, 
      updated_at
    ) VALUES
    ('Dr. Sarah Johnson', '+91 9876543210', 35, '123 Education Lane, Mumbai', 'M.Sc Physics, B.Ed', 45000.00, 'monthly', true, 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Mr. Rajesh Kumar', '+91 9876543211', 42, '456 Science Street, Delhi', 'M.A Mathematics, B.Ed', 48000.00, 'monthly', true, 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Ms. Priya Sharma', '+91 9876543212', 29, '789 Literature Ave, Bangalore', 'M.A English, B.Ed', 42000.00, 'monthly', false, 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Mr. Arun Patel', '+91 9876543213', 38, '321 History Road, Chennai', 'M.A History, B.Ed', 44000.00, 'monthly', true, 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Dr. Kavitha Reddy', '+91 9876543214', 33, '654 Chemistry Block, Hyderabad', 'M.Sc Chemistry, Ph.D', 50000.00, 'monthly', false, 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW());
    
    RAISE NOTICE '✅ Sample teachers created successfully!';
  ELSE
    RAISE NOTICE '📋 Teachers already exist for this tenant, skipping creation.';
  END IF;
END $$;

-- ========================================
-- STEP 2: Assign teachers to classes (as class teachers)
-- ========================================

-- Assign class teachers to classes
DO $$
DECLARE
    teacher_record RECORD;
    class_record RECORD;
BEGIN
    -- Get teachers and classes for this tenant
    FOR teacher_record IN 
        SELECT id, name FROM public.teachers 
        WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' 
        AND is_class_teacher = true
        ORDER BY name
        LIMIT 4  -- Assign first 4 class teachers
    LOOP
        -- Get an available class (one without a class teacher)
        SELECT id, class_name INTO class_record
        FROM public.classes 
        WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        AND class_teacher_id IS NULL
        ORDER BY class_name
        LIMIT 1;
        
        IF class_record.id IS NOT NULL THEN
            -- Assign teacher to class
            UPDATE public.classes 
            SET class_teacher_id = teacher_record.id
            WHERE id = class_record.id;
            
            RAISE NOTICE 'Assigned teacher % to class %', teacher_record.name, class_record.class_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Teachers assigned to classes as class teachers!';
END $$;

-- ========================================
-- STEP 3: Create teacher-subject assignments
-- ========================================

-- Assign subjects to teachers
DO $$
DECLARE
    teacher_record RECORD;
    subject_record RECORD;
    assignment_count INTEGER := 0;
BEGIN
    -- Check if teacher-subject assignments exist
    IF (SELECT COUNT(*) FROM public.teacher_subjects WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
        
        -- Assign subjects to each teacher based on their qualifications
        FOR teacher_record IN 
            SELECT id, name, qualification FROM public.teachers 
            WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        LOOP
            -- Assign subjects based on teacher's qualification
            FOR subject_record IN 
                SELECT id, name, class_id FROM public.subjects 
                WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
                AND (
                    (teacher_record.qualification ILIKE '%Physics%' AND name ILIKE '%Physics%') OR
                    (teacher_record.qualification ILIKE '%Mathematics%' AND name ILIKE '%Math%') OR
                    (teacher_record.qualification ILIKE '%English%' AND name ILIKE '%English%') OR
                    (teacher_record.qualification ILIKE '%History%' AND name ILIKE '%History%') OR
                    (teacher_record.qualification ILIKE '%Chemistry%' AND name ILIKE '%Chemistry%') OR
                    -- Fallback: assign first few subjects if no match
                    (teacher_record.qualification NOT ILIKE '%Physics%' AND 
                     teacher_record.qualification NOT ILIKE '%Mathematics%' AND 
                     teacher_record.qualification NOT ILIKE '%English%' AND 
                     teacher_record.qualification NOT ILIKE '%History%' AND 
                     teacher_record.qualification NOT ILIKE '%Chemistry%')
                )
                LIMIT 2  -- Assign up to 2 subjects per teacher
            LOOP
                -- Create teacher-subject assignment
                INSERT INTO public.teacher_subjects (
                    teacher_id,
                    subject_id,
                    tenant_id,
                    created_at,
                    updated_at
                ) VALUES (
                    teacher_record.id,
                    subject_record.id,
                    'b8f8b5f0-1234-4567-8901-123456789000',
                    NOW(),
                    NOW()
                );
                
                assignment_count := assignment_count + 1;
                RAISE NOTICE 'Assigned subject % to teacher %', subject_record.name, teacher_record.name;
            END LOOP;
        END LOOP;
        
        RAISE NOTICE '✅ Created % teacher-subject assignments!', assignment_count;
    ELSE
        RAISE NOTICE '📋 Teacher-subject assignments already exist for this tenant, skipping creation.';
    END IF;
END $$;

-- ========================================
-- STEP 4: Create sample teacher attendance records
-- ========================================

-- Create attendance records for teachers
DO $$
DECLARE
    teacher_record RECORD;
    attendance_count INTEGER := 0;
BEGIN
    -- Check if teacher attendance records exist
    IF (SELECT COUNT(*) FROM public.teacher_attendance WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
        
        -- Create attendance records for last 10 days for each teacher
        FOR teacher_record IN 
            SELECT id, name FROM public.teachers 
            WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        LOOP
            -- Create attendance for last 10 days
            FOR i IN 1..10 LOOP
                INSERT INTO public.teacher_attendance (
                    teacher_id,
                    date,
                    status,
                    check_in_time,
                    check_out_time,
                    tenant_id,
                    created_at,
                    updated_at
                ) VALUES (
                    teacher_record.id,
                    CURRENT_DATE - INTERVAL '1 day' * i,
                    CASE WHEN RANDOM() > 0.1 THEN 'present' ELSE 'absent' END,  -- 90% attendance rate
                    CASE WHEN RANDOM() > 0.1 THEN ('08:' || LPAD(FLOOR(RANDOM() * 60)::text, 2, '0') || ':00')::TIME ELSE NULL END,
                    CASE WHEN RANDOM() > 0.1 THEN ('17:' || LPAD(FLOOR(RANDOM() * 60)::text, 2, '0') || ':00')::TIME ELSE NULL END,
                    'b8f8b5f0-1234-4567-8901-123456789000',
                    NOW(),
                    NOW()
                );
                
                attendance_count := attendance_count + 1;
            END LOOP;
        END LOOP;
        
        RAISE NOTICE '✅ Created % teacher attendance records!', attendance_count;
    ELSE
        RAISE NOTICE '📋 Teacher attendance records already exist for this tenant, skipping creation.';
    END IF;
END $$;

-- ========================================
-- STEP 5: Create sample tasks for teachers (if tasks table exists)
-- ========================================

DO $$
DECLARE
    teacher_record RECORD;
    task_count INTEGER := 0;
BEGIN
    -- Check if tasks table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        -- Check if tasks exist for this tenant
        IF (SELECT COUNT(*) FROM public.tasks WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
            
            -- Create sample tasks for each teacher
            FOR teacher_record IN 
                SELECT id, name FROM public.teachers 
                WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
                LIMIT 3  -- Create tasks for first 3 teachers
            LOOP
                -- Create 2 tasks per teacher
                INSERT INTO public.tasks (
                    title,
                    description,
                    assigned_to,
                    status,
                    priority,
                    due_date,
                    tenant_id,
                    created_at,
                    updated_at
                ) VALUES 
                (
                    'Prepare Monthly Test Papers',
                    'Create question papers for the monthly assessment for assigned subjects',
                    teacher_record.id,
                    'pending',
                    'high',
                    CURRENT_DATE + INTERVAL '7 days',
                    'b8f8b5f0-1234-4567-8901-123456789000',
                    NOW(),
                    NOW()
                ),
                (
                    'Update Student Progress Reports',
                    'Complete progress evaluation and update student report cards',
                    teacher_record.id,
                    'in_progress',
                    'medium',
                    CURRENT_DATE + INTERVAL '14 days',
                    'b8f8b5f0-1234-4567-8901-123456789000',
                    NOW(),
                    NOW()
                );
                
                task_count := task_count + 2;
                RAISE NOTICE 'Created 2 tasks for teacher %', teacher_record.name;
            END LOOP;
            
            RAISE NOTICE '✅ Created % sample tasks for teachers!', task_count;
        ELSE
            RAISE NOTICE '📋 Tasks already exist for this tenant, skipping creation.';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ️ Tasks table does not exist, skipping task creation.';
    END IF;
END $$;

-- ========================================
-- STEP 6: Link teachers to user accounts (if user accounts exist)
-- ========================================

-- Try to link teachers with existing user accounts
DO $$
DECLARE
    teacher_record RECORD;
    user_record RECORD;
    link_count INTEGER := 0;
BEGIN
    -- Look for teachers that might need user account linking
    FOR teacher_record IN 
        SELECT id, name, phone FROM public.teachers 
        WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        LIMIT 3  -- Link first 3 teachers
    LOOP
        -- Try to find a user account that might belong to this teacher
        -- This is a simplified approach - in reality you'd have better matching logic
        SELECT id, email INTO user_record
        FROM public.users 
        WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        AND role_id = (SELECT id FROM public.roles WHERE name = 'Teacher' LIMIT 1)
        AND linked_teacher_id IS NULL
        LIMIT 1;
        
        IF user_record.id IS NOT NULL THEN
            -- Link the user account to the teacher
            UPDATE public.users 
            SET linked_teacher_id = teacher_record.id
            WHERE id = user_record.id;
            
            link_count := link_count + 1;
            RAISE NOTICE 'Linked teacher % to user account %', teacher_record.name, user_record.email;
        END IF;
    END LOOP;
    
    IF link_count > 0 THEN
        RAISE NOTICE '✅ Linked % teachers to user accounts!', link_count;
    ELSE
        RAISE NOTICE 'ℹ️ No available user accounts to link to teachers.';
    END IF;
END $$;

-- ========================================
-- STEP 7: Verify the created data
-- ========================================

-- Show what we created
SELECT 'Data Summary for Teacher Management (Tenant b8f8b5f0-1234-4567-8901-123456789000):' as info;

SELECT 'Teachers created:' as table_name, COUNT(*) as count 
FROM public.teachers 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
UNION ALL
SELECT 'Classes with assigned class teachers:', COUNT(*) 
FROM public.classes 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
AND class_teacher_id IS NOT NULL
UNION ALL
SELECT 'Teacher-subject assignments:', COUNT(*) 
FROM public.teacher_subjects 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
UNION ALL
SELECT 'Teacher attendance records:', COUNT(*) 
FROM public.teacher_attendance 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Show teacher details with their assignments
SELECT 'Teacher Details with Assignments:' as info;
SELECT 
    t.name as teacher_name,
    t.qualification,
    t.salary_amount,
    t.is_class_teacher,
    COALESCE(c.class_name, 'No class assigned') as assigned_class,
    COUNT(ts.subject_id) as subjects_teaching
FROM public.teachers t
LEFT JOIN public.classes c ON c.class_teacher_id = t.id AND c.tenant_id = t.tenant_id
LEFT JOIN public.teacher_subjects ts ON ts.teacher_id = t.id AND ts.tenant_id = t.tenant_id
WHERE t.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
GROUP BY t.id, t.name, t.qualification, t.salary_amount, t.is_class_teacher, c.class_name
ORDER BY t.name;

-- Show subject assignments
SELECT 'Subject Assignments:' as info;
SELECT 
    t.name as teacher_name,
    s.name as subject_name,
    c.class_name
FROM public.teacher_subjects ts
JOIN public.teachers t ON t.id = ts.teacher_id
JOIN public.subjects s ON s.id = ts.subject_id
JOIN public.classes c ON c.id = s.class_id
WHERE ts.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
ORDER BY t.name, s.name;

-- Show recent attendance summary
SELECT 'Recent Attendance Summary (Last 7 days):' as info;
SELECT 
    t.name as teacher_name,
    COUNT(CASE WHEN ta.status = 'present' THEN 1 END) as days_present,
    COUNT(CASE WHEN ta.status = 'absent' THEN 1 END) as days_absent,
    ROUND(
        (COUNT(CASE WHEN ta.status = 'present' THEN 1 END) * 100.0 / 
         NULLIF(COUNT(ta.status), 0)), 2
    ) as attendance_percentage
FROM public.teachers t
LEFT JOIN public.teacher_attendance ta ON ta.teacher_id = t.id 
    AND ta.date >= CURRENT_DATE - INTERVAL '7 days'
    AND ta.tenant_id = t.tenant_id
WHERE t.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
GROUP BY t.id, t.name
ORDER BY t.name;

-- Success message
SELECT '🎉 Sample teacher management data created successfully!' as completion_message;
SELECT '👨‍🏫 You should now see teachers, assignments, and attendance in the Manage Teachers screen!' as final_message;
