-- Temporarily Disable RLS for Testing Student Fee Data Access
-- This will help us verify if RLS policies are blocking fee data access

BEGIN;

-- Disable RLS on all key tables to test data access
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;

-- Disable RLS on fee-related tables
DO $$
BEGIN
    -- Only disable if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_structure') THEN
        ALTER TABLE public.fee_structure DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on fee_structure';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_payments') THEN
        ALTER TABLE public.fee_payments DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on fee_payments';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_fee_structure') THEN
        ALTER TABLE public.student_fee_structure DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on student_fee_structure';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fee_components') THEN
        ALTER TABLE public.fee_components DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on fee_components';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'marks') THEN
        ALTER TABLE public.marks DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on marks';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_attendance') THEN
        ALTER TABLE public.student_attendance DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on student_attendance';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments') THEN
        ALTER TABLE public.assignments DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on assignments';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'homeworks') THEN
        ALTER TABLE public.homeworks DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on homeworks';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on notifications';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notification_recipients') THEN
        ALTER TABLE public.notification_recipients DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on notification_recipients';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timetable') THEN
        ALTER TABLE public.timetable DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on timetable';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN
        ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on subjects';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exams') THEN
        ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS on exams';
    END IF;
END $$;

-- Grant basic permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

COMMIT;

-- Show tables with RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'students', 'tenants', 'classes', 'fee_structure', 'fee_payments', 'marks', 'student_attendance')
ORDER BY tablename;

SELECT 'SUCCESS: RLS temporarily disabled for testing' as status,
       'Now try accessing the student fee payment screen' as instruction,
       'If data shows up, the issue was RLS policies' as diagnosis;
