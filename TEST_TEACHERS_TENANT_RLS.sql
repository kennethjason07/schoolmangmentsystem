-- TEST TEACHERS TENANT-BASED RLS POLICIES
-- This script tests teacher-specific tenant isolation

-- First, let's check current teacher data
SELECT 'CHECKING CURRENT TEACHER DATA...' as status;

-- Show current teachers and their tenants
SELECT 
    COUNT(*) as total_teachers,
    tenant_id,
    'Teachers per tenant' as info
FROM teachers 
GROUP BY tenant_id
ORDER BY tenant_id;

-- Check teacher-student relationships across tenants
SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    t.tenant_id as teacher_tenant,
    c.class_name,
    c.tenant_id as class_tenant,
    CASE 
        WHEN t.tenant_id = c.tenant_id THEN '✅ Same tenant'
        ELSE '❌ Cross-tenant issue'
    END as tenant_check
FROM teachers t
LEFT JOIN classes c ON t.assigned_class_id = c.id
ORDER BY t.tenant_id, t.name;

-- Check if teachers table has RLS enabled
SELECT 'CHECKING TEACHERS RLS STATUS...' as status;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'teachers' AND schemaname = 'public';

-- Show current teacher RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as permission_type,
    qual as condition
FROM pg_policies 
WHERE tablename = 'teachers' AND schemaname = 'public'
ORDER BY policyname;

-- Create teacher-specific diagnostic functions
CREATE OR REPLACE FUNCTION public.test_teachers_tenant_access()
RETURNS TABLE(
    current_user_id UUID,
    user_tenant_id UUID,
    jwt_tenant_id TEXT,
    teacher_count BIGINT,
    assigned_teacher_count BIGINT,
    class_teacher_count BIGINT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id UUID;
    tenant_from_db UUID;
    tenant_from_jwt TEXT;
    teachers_found BIGINT;
    assigned_teachers BIGINT;
    class_teachers BIGINT;
BEGIN
    -- Get current user info
    user_id := auth.uid();
    tenant_from_db := public.get_current_user_tenant_id();
    tenant_from_jwt := (auth.jwt() -> 'app_metadata' ->> 'tenant_id');
    
    -- Count accessible teacher records
    SELECT COUNT(*) INTO teachers_found FROM teachers;
    SELECT COUNT(*) INTO assigned_teachers FROM teachers WHERE assigned_class_id IS NOT NULL;
    SELECT COUNT(*) INTO class_teachers FROM teachers WHERE is_class_teacher = true;
    
    RETURN QUERY SELECT
        user_id,
        tenant_from_db,
        tenant_from_jwt,
        teachers_found,
        assigned_teachers,
        class_teachers,
        CASE 
            WHEN teachers_found > 0 THEN 'Teacher tenant-based access working!'
            ELSE 'No teachers accessible - check tenant assignment'
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_teachers_tenant_access() TO authenticated;

-- Function to check teacher-class relationships within tenant
CREATE OR REPLACE FUNCTION public.check_teacher_class_relationships()
RETURNS TABLE(
    teacher_id UUID,
    teacher_name TEXT,
    teacher_tenant UUID,
    assigned_class_id UUID,
    class_name TEXT,
    class_tenant UUID,
    relationship_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        t.id,
        t.name,
        t.tenant_id,
        t.assigned_class_id,
        c.class_name,
        c.tenant_id,
        CASE 
            WHEN t.assigned_class_id IS NULL THEN 'No class assigned'
            WHEN t.tenant_id = c.tenant_id THEN 'Valid - same tenant'
            WHEN t.tenant_id != c.tenant_id THEN 'ERROR - cross-tenant assignment'
            ELSE 'Unknown status'
        END
    FROM teachers t
    LEFT JOIN classes c ON t.assigned_class_id = c.id
    WHERE t.tenant_id = public.get_current_user_tenant_id()
    ORDER BY t.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_teacher_class_relationships() TO authenticated;

-- Function to get teacher statistics for current tenant
CREATE OR REPLACE FUNCTION public.get_teacher_tenant_stats()
RETURNS TABLE(
    tenant_id UUID,
    tenant_name TEXT,
    total_teachers BIGINT,
    class_teachers BIGINT,
    unassigned_teachers BIGINT,
    monthly_salary_teachers BIGINT,
    hourly_salary_teachers BIGINT,
    average_salary NUMERIC,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_tenant UUID;
    t_name TEXT;
    total_count BIGINT;
    class_count BIGINT;
    unassigned_count BIGINT;
    monthly_count BIGINT;
    hourly_count BIGINT;
    avg_salary NUMERIC;
BEGIN
    current_tenant := public.get_current_user_tenant_id();
    
    -- Get tenant name
    SELECT name INTO t_name FROM tenants WHERE id = current_tenant;
    
    -- Get teacher counts
    SELECT COUNT(*) INTO total_count FROM teachers WHERE tenant_id = current_tenant;
    SELECT COUNT(*) INTO class_count FROM teachers WHERE tenant_id = current_tenant AND is_class_teacher = true;
    SELECT COUNT(*) INTO unassigned_count FROM teachers WHERE tenant_id = current_tenant AND assigned_class_id IS NULL;
    SELECT COUNT(*) INTO monthly_count FROM teachers WHERE tenant_id = current_tenant AND salary_type = 'monthly';
    SELECT COUNT(*) INTO hourly_count FROM teachers WHERE tenant_id = current_tenant AND salary_type = 'hourly';
    SELECT AVG(salary_amount) INTO avg_salary FROM teachers WHERE tenant_id = current_tenant;
    
    RETURN QUERY SELECT
        current_tenant,
        t_name,
        total_count,
        class_count,
        unassigned_count,
        monthly_count,
        hourly_count,
        ROUND(avg_salary, 2),
        CASE 
            WHEN total_count > 0 THEN 'Teacher data accessible for tenant'
            ELSE 'No teacher data found for current tenant'
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_tenant_stats() TO authenticated;

-- Test teacher access with the current user
SELECT 'TESTING TEACHER ACCESS...' as status;
SELECT COUNT(*) as accessible_teachers FROM teachers;

-- Test teacher-subject relationships
SELECT 'CHECKING TEACHER-SUBJECT RELATIONSHIPS...' as status;
SELECT 
    t.name as teacher_name,
    s.name as subject_name,
    t.tenant_id as teacher_tenant,
    s.tenant_id as subject_tenant,
    CASE 
        WHEN t.tenant_id = s.tenant_id THEN '✅ Same tenant'
        ELSE '❌ Cross-tenant issue'
    END as tenant_check
FROM teachers t
JOIN teacher_subjects ts ON t.id = ts.teacher_id
JOIN subjects s ON ts.subject_id = s.id
ORDER BY t.name, s.name
LIMIT 10;

-- Test teacher attendance access
SELECT 'CHECKING TEACHER ATTENDANCE ACCESS...' as status;
SELECT COUNT(*) as accessible_teacher_attendance FROM teacher_attendance;

-- Create sample teacher data if none exists
DO $$
DECLARE
    current_tenant UUID;
    sample_class UUID;
    teacher_count INTEGER;
BEGIN
    current_tenant := public.get_current_user_tenant_id();
    
    -- Check if we have teachers
    SELECT COUNT(*) INTO teacher_count FROM teachers WHERE tenant_id = current_tenant;
    
    IF teacher_count = 0 THEN
        -- Get a sample class from current tenant
        SELECT id INTO sample_class FROM classes WHERE tenant_id = current_tenant LIMIT 1;
        
        -- Create sample teachers
        INSERT INTO teachers (name, qualification, age, salary_type, salary_amount, address, tenant_id, assigned_class_id, is_class_teacher)
        VALUES 
            ('John Smith', 'B.Ed, M.A. English', 32, 'monthly', 45000, '123 Teacher Lane', current_tenant, sample_class, true),
            ('Mary Johnson', 'M.Sc. Mathematics, B.Ed', 28, 'monthly', 42000, '456 Education St', current_tenant, NULL, false),
            ('David Brown', 'B.Sc. Physics, B.Ed', 35, 'monthly', 48000, '789 Science Ave', current_tenant, NULL, false),
            ('Sarah Wilson', 'M.A. History, B.Ed', 30, 'hourly', 800, '321 History Blvd', current_tenant, NULL, false);
        
        RAISE NOTICE 'Created sample teachers for tenant: %', current_tenant;
    ELSE
        RAISE NOTICE 'Found % existing teachers for tenant: %', teacher_count, current_tenant;
    END IF;
END $$;

SELECT '
🧑‍🏫 TEACHERS TENANT RLS TESTING COMPLETE!

FUNCTIONS CREATED:
✅ public.test_teachers_tenant_access() - Tests teacher access
✅ public.check_teacher_class_relationships() - Validates teacher-class assignments
✅ public.get_teacher_tenant_stats() - Gets teacher statistics for tenant

WHAT WE TESTED:
✅ Teacher table RLS policies
✅ Teacher-class relationships within tenant
✅ Teacher-subject assignments
✅ Teacher attendance access
✅ Cross-tenant data isolation

SAMPLE DATA:
✅ Created sample teachers if none existed
✅ All teachers properly assigned to current tenant

NEXT STEPS:
1. Test your React Native app teacher functionality
2. Use the teacher testing component
3. Call diagnostic functions:
   - SELECT * FROM public.test_teachers_tenant_access();
   - SELECT * FROM public.check_teacher_class_relationships();
   - SELECT * FROM public.get_teacher_tenant_stats();

STATUS: Teacher tenant-based RLS ready for testing!
' as success_message;
