-- ===================================================================
-- ADD SIMPLE UNIQUE CONSTRAINT TO STUDENT_ATTENDANCE TABLE
-- ===================================================================
-- This script adds a simple unique constraint without tenant_id for immediate fix

-- Step 1: Check if the constraint already exists
DO $$
BEGIN
    -- Check if any unique constraint exists on student_attendance table
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint pc
        JOIN pg_class pc2 ON pc.conrelid = pc2.oid
        WHERE pc2.relname = 'student_attendance' 
        AND pc.contype = 'u'
    ) THEN
        RAISE NOTICE 'No unique constraints found on student_attendance table. Adding simple constraint...';
        
        -- Add the unique constraint WITHOUT tenant_id (simpler approach)
        ALTER TABLE public.student_attendance 
        ADD CONSTRAINT unique_student_attendance_per_day 
        UNIQUE (student_id, date);
        
        RAISE NOTICE '✅ Added unique constraint: (student_id, date)';
    ELSE 
        RAISE NOTICE '⚠️ Unique constraint already exists on student_attendance';
    END IF;
END $$;

-- Step 2: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_student_date 
ON public.student_attendance (student_id, date);

-- Step 3: Verify the constraint was created
SELECT 
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
    tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name = 'student_attendance'
GROUP BY tc.constraint_name, tc.table_name;

-- Step 4: Show success message
DO $$
BEGIN
    RAISE NOTICE '🎉 SIMPLE CONSTRAINT CREATION COMPLETED!';
    RAISE NOTICE 'You can now use: onConflict: ''student_id,date''';
    RAISE NOTICE 'The attendance submission should work correctly now.';
END $$;
