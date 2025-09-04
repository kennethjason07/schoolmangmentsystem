-- ================================================================
-- ADD MISSING DELETE POLICY FOR STUDENT_ATTENDANCE RLS
-- ================================================================
-- This script adds the missing DELETE policy to ensure proper RLS
-- support for the delete-then-insert attendance workaround

-- Check current RLS policies
SELECT 
    'Current RLS Policies' as status,
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename = 'student_attendance'
ORDER BY policyname;

-- Add DELETE policy if missing
DO $$
BEGIN
    -- Check if DELETE policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'student_attendance' 
        AND cmd = 'DELETE'
    ) THEN
        -- Create DELETE policy
        CREATE POLICY "tenant_student_attendance_delete" ON student_attendance
        FOR DELETE 
        TO authenticated
        USING (
            tenant_id = (
                SELECT u.tenant_id 
                FROM public.users u 
                WHERE u.id = auth.uid()
            )
        );
        
        RAISE NOTICE '✅ Added DELETE policy for student_attendance';
    ELSE
        RAISE NOTICE '✅ DELETE policy already exists for student_attendance';
    END IF;
END $$;

-- Also ensure we have a comprehensive policy that covers ALL operations
-- This is safer than having separate policies
DO $$
BEGIN
    -- Drop the old tenant isolation policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'student_attendance' AND policyname = 'tenant_isolation_policy') THEN
        DROP POLICY tenant_isolation_policy ON student_attendance;
        RAISE NOTICE '🔄 Dropped old tenant_isolation_policy';
    END IF;
    
    -- Create a comprehensive policy for all operations
    CREATE POLICY "tenant_student_attendance_all_operations" ON student_attendance
    FOR ALL 
    TO authenticated
    USING (
        tenant_id = (
            SELECT u.tenant_id 
            FROM public.users u 
            WHERE u.id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id = (
            SELECT u.tenant_id 
            FROM public.users u 
            WHERE u.id = auth.uid()
        )
    );
    
    RAISE NOTICE '✅ Created comprehensive ALL operations policy';
END $$;

-- Verify RLS is enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE tablename = 'student_attendance' 
        AND rowsecurity = true
    ) THEN
        ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✅ Enabled RLS on student_attendance table';
    ELSE
        RAISE NOTICE '✅ RLS already enabled on student_attendance table';
    END IF;
END $$;

-- Show final RLS policies
SELECT 
    'Final RLS Policies' as status,
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN cmd = 'ALL' THEN '🟢 Covers all operations'
        WHEN cmd = 'SELECT' THEN '🔍 Read access'
        WHEN cmd = 'INSERT' THEN '➕ Create access'
        WHEN cmd = 'UPDATE' THEN '✏️ Modify access'
        WHEN cmd = 'DELETE' THEN '🗑️ Delete access'
    END as policy_description
FROM pg_policies 
WHERE tablename = 'student_attendance'
ORDER BY cmd, policyname;

-- Test that RLS is working by showing current user context
SELECT 
    'Current User Context' as status,
    auth.uid() as current_user_id,
    (
        SELECT u.tenant_id 
        FROM public.users u 
        WHERE u.id = auth.uid()
    ) as current_user_tenant_id,
    (
        SELECT COUNT(*) 
        FROM student_attendance 
        WHERE tenant_id = (
            SELECT u.tenant_id 
            FROM public.users u 
            WHERE u.id = auth.uid()
        )
    ) as accessible_attendance_records;

RAISE NOTICE '🎉 RLS DELETE policy setup completed!';
RAISE NOTICE '📝 The attendance code delete-then-insert workaround will now work with proper RLS isolation';
RAISE NOTICE '🔒 Only attendance records for the current user''s tenant will be accessible';
