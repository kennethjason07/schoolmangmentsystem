-- ===================================================================
-- ADD UNIQUE CONSTRAINT TO STUDENT_ATTENDANCE TABLE
-- ===================================================================
-- This script adds the missing unique constraint to prevent duplicate attendance records
-- and enable proper upsert functionality in the React Native app.

-- Step 1: Check current table structure and constraints
SELECT 
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'student_attendance' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 2: Check existing constraints
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'student_attendance' 
    AND tc.table_schema = 'public'
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type;

-- Step 3: Check for existing duplicate records before adding constraint
SELECT 
    student_id, 
    date, 
    tenant_id,
    COUNT(*) as duplicate_count
FROM public.student_attendance 
GROUP BY student_id, date, tenant_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 4: Remove duplicates if any exist (keeping the latest record)
-- WARNING: This will delete duplicate records, keeping only the most recent one
WITH ranked_records AS (
    SELECT 
        id,
        student_id,
        date,
        tenant_id,
        ROW_NUMBER() OVER (
            PARTITION BY student_id, date, tenant_id 
            ORDER BY created_at DESC, id DESC
        ) as rn
    FROM public.student_attendance
)
DELETE FROM public.student_attendance 
WHERE id IN (
    SELECT id FROM ranked_records WHERE rn > 1
);

-- Step 5: Add the unique constraint
-- This constraint ensures one attendance record per student per date per tenant
ALTER TABLE public.student_attendance 
ADD CONSTRAINT unique_student_attendance_per_day 
UNIQUE (student_id, date, tenant_id);

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_lookup 
ON public.student_attendance (student_id, date, tenant_id, class_id);

-- Step 7: Verify the constraint was created successfully
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name = 'student_attendance'
    AND tc.table_schema = 'public'
GROUP BY tc.constraint_name, tc.constraint_type, tc.table_name;

-- Step 8: Show success message
DO $$
BEGIN
    RAISE NOTICE '✅ UNIQUE CONSTRAINT ADDED SUCCESSFULLY!';
    RAISE NOTICE '📝 Constraint name: unique_student_attendance_per_day';
    RAISE NOTICE '🔧 Constraint columns: (student_id, date, tenant_id)';
    RAISE NOTICE '💻 React Native app can now use: onConflict: "student_id,date,tenant_id"';
    RAISE NOTICE '🎉 Attendance upsert functionality should work correctly now!';
END $$;
