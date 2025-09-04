-- Simple RLS Policies for Leave Applications (Option A)
-- Any authenticated user can read, insert, and update leave applications
-- Run this in Supabase SQL Editor

-- ========================================
-- STEP 1: Enable RLS on leave_applications table
-- ========================================

-- Enable Row Level Security
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: Create simple RLS policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to read leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to insert leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to update leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to delete leave applications" ON public.leave_applications;

-- Simple policies: Any authenticated user can do everything
CREATE POLICY "Allow authenticated to read leave applications"
ON public.leave_applications
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated to insert leave applications"
ON public.leave_applications
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated to update leave applications"
ON public.leave_applications
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated to delete leave applications"
ON public.leave_applications
FOR DELETE
TO authenticated
USING (true);

-- ========================================
-- STEP 3: Create sample leave applications for testing
-- ========================================

-- Check current count
SELECT 'Current leave applications count:' as info, COUNT(*) as count 
FROM public.leave_applications;

-- Get the current user ID for sample data
-- You'll need to replace this with an actual user ID from your users table
DO $$
DECLARE
    sample_user_id UUID;
    sample_teacher_id UUID;
    sample_tenant_id UUID;
BEGIN
    -- Try to find a user to use for sample data
    SELECT id, linked_teacher_id, tenant_id INTO sample_user_id, sample_teacher_id, sample_tenant_id
    FROM public.users 
    WHERE email LIKE '%@gmail.com' 
    LIMIT 1;
    
    IF sample_user_id IS NOT NULL THEN
        -- Only insert if table is empty
        IF (SELECT COUNT(*) FROM public.leave_applications) = 0 THEN
            
            INSERT INTO public.leave_applications (
                teacher_id,
                leave_type,
                start_date,
                end_date,
                reason,
                status,
                applied_date,
                applied_by,
                tenant_id
            ) VALUES 
            (
                sample_teacher_id,
                'Sick',
                '2025-09-05',
                '2025-09-06',
                'Feeling unwell, need rest to recover',
                'Pending',
                CURRENT_DATE,
                sample_user_id,
                sample_tenant_id
            ),
            (
                sample_teacher_id,
                'Casual',
                '2025-09-10',
                '2025-09-10',
                'Personal work to complete',
                'Approved',
                CURRENT_DATE - INTERVAL '2 days',
                sample_user_id,
                sample_tenant_id
            ),
            (
                sample_teacher_id,
                'Emergency',
                '2025-09-15',
                '2025-09-17',
                'Family emergency requiring immediate attention',
                'Pending',
                CURRENT_DATE - INTERVAL '1 day',
                sample_user_id,
                sample_tenant_id
            );
            
            RAISE NOTICE '✅ Sample leave applications created successfully!';
        ELSE
            RAISE NOTICE '📋 Leave applications already exist, skipping sample data creation.';
        END IF;
    ELSE
        RAISE NOTICE '❌ No user found for sample data creation. Please create sample data manually.';
    END IF;
END $$;

-- ========================================
-- STEP 4: Verify the setup
-- ========================================

-- Show all leave applications
SELECT 'All leave applications:' as info;
SELECT 
    id,
    teacher_id,
    leave_type,
    start_date,
    end_date,
    status,
    reason,
    applied_by,
    tenant_id,
    created_at
FROM public.leave_applications
ORDER BY COALESCE(applied_date, created_at) DESC;

-- Show RLS policies
SELECT 'Leave applications RLS policies:' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'leave_applications'
ORDER BY policyname;

-- Test access with count
SELECT 'Testing leave applications access:' as info;
SELECT COUNT(*) as accessible_leaves FROM public.leave_applications;

-- Show success message
SELECT '✅ Simple RLS policies applied successfully!' as completion_message;
SELECT '🎉 Leave management should now work for authenticated users!' as final_message;
