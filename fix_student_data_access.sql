-- FIX STUDENT DATA ACCESS ISSUES
-- This script addresses common issues preventing student details retrieval

-- 1. First, let's check what we're working with
DO $$
BEGIN
    RAISE NOTICE '🔍 DIAGNOSING STUDENT DATA ACCESS ISSUES...';
END $$;

-- Check if students table exists and has data
DO $$
DECLARE
    student_count INTEGER;
    tenant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO student_count FROM students;
    SELECT COUNT(DISTINCT tenant_id) INTO tenant_count FROM students;
    
    RAISE NOTICE '📊 Students table has % records across % tenants', student_count, tenant_count;
    
    IF student_count = 0 THEN
        RAISE NOTICE '⚠️  WARNING: No students found in database';
    END IF;
END $$;

-- 2. Fix RLS policies for students and related tables
RAISE NOTICE '🔧 Fixing RLS policies...';

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "tenant_students_policy" ON students;
DROP POLICY IF EXISTS "tenant_classes_policy" ON classes;
DROP POLICY IF EXISTS "tenant_parents_policy" ON parents;
DROP POLICY IF EXISTS "tenant_users_policy" ON users;

-- Enable RLS on core tables
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for students
CREATE POLICY "tenant_students_policy" ON students
    FOR ALL
    USING (
        -- Allow if tenant_id matches user's tenant_id from JWT or users table
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
        OR
        -- Allow service role to access everything
        auth.role() = 'service_role'
    );

-- Create RLS policy for classes
CREATE POLICY "tenant_classes_policy" ON classes
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
        OR
        auth.role() = 'service_role'
    );

-- Create RLS policy for parents
CREATE POLICY "tenant_parents_policy" ON parents
    FOR ALL
    USING (
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
        OR
        auth.role() = 'service_role'
    );

-- Create RLS policy for users (more permissive for auth operations)
CREATE POLICY "tenant_users_policy" ON users
    FOR ALL
    USING (
        -- User can access their own record
        id = auth.uid()
        OR
        -- Or if tenant_id matches
        tenant_id::text = COALESCE(
            auth.jwt()->>'tenant_id',
            (SELECT tenant_id::text FROM users WHERE id = auth.uid())
        )
        OR
        -- Service role access
        auth.role() = 'service_role'
    );

-- 3. Check for missing tenant_id values and fix them
DO $$
DECLARE
    default_tenant_id UUID;
    students_without_tenant INTEGER;
    classes_without_tenant INTEGER;
    parents_without_tenant INTEGER;
    users_without_tenant INTEGER;
BEGIN
    -- Get a default tenant_id (use the first one we find)
    SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
    
    IF default_tenant_id IS NULL THEN
        RAISE NOTICE '⚠️  WARNING: No tenants found in database';
        -- Create a default tenant for this school
        INSERT INTO tenants (id, name, subdomain, status)
        VALUES (
            gen_random_uuid(), 
            'Default School', 
            'school', 
            'active'
        )
        RETURNING id INTO default_tenant_id;
        
        RAISE NOTICE '✅ Created default tenant: %', default_tenant_id;
    END IF;
    
    -- Check and fix students without tenant_id
    SELECT COUNT(*) INTO students_without_tenant 
    FROM students WHERE tenant_id IS NULL;
    
    IF students_without_tenant > 0 THEN
        UPDATE students SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        RAISE NOTICE '🔧 Fixed % students without tenant_id', students_without_tenant;
    END IF;
    
    -- Check and fix classes without tenant_id
    SELECT COUNT(*) INTO classes_without_tenant 
    FROM classes WHERE tenant_id IS NULL;
    
    IF classes_without_tenant > 0 THEN
        UPDATE classes SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        RAISE NOTICE '🔧 Fixed % classes without tenant_id', classes_without_tenant;
    END IF;
    
    -- Check and fix parents without tenant_id
    SELECT COUNT(*) INTO parents_without_tenant 
    FROM parents WHERE tenant_id IS NULL;
    
    IF parents_without_tenant > 0 THEN
        UPDATE parents SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        RAISE NOTICE '🔧 Fixed % parents without tenant_id', parents_without_tenant;
    END IF;
    
    -- Check and fix users without tenant_id
    SELECT COUNT(*) INTO users_without_tenant 
    FROM users WHERE tenant_id IS NULL;
    
    IF users_without_tenant > 0 THEN
        UPDATE users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        RAISE NOTICE '🔧 Fixed % users without tenant_id', users_without_tenant;
    END IF;
    
    RAISE NOTICE '✅ Default tenant ID for all records: %', default_tenant_id;
END $$;

-- 4. Create helper functions for debugging
CREATE OR REPLACE FUNCTION debug_student_access(user_email TEXT DEFAULT NULL)
RETURNS TABLE (
    table_name TEXT,
    total_records BIGINT,
    accessible_records BIGINT,
    sample_tenant_ids TEXT[]
) AS $$
DECLARE
    target_user_id UUID;
    target_tenant_id UUID;
BEGIN
    -- If email provided, get that user's info
    IF user_email IS NOT NULL THEN
        SELECT id, tenant_id INTO target_user_id, target_tenant_id 
        FROM users WHERE email = user_email;
        
        IF target_user_id IS NULL THEN
            RAISE EXCEPTION 'User with email % not found', user_email;
        END IF;
    ELSE
        -- Use current authenticated user
        target_user_id := auth.uid();
        SELECT tenant_id INTO target_tenant_id FROM users WHERE id = target_user_id;
    END IF;
    
    -- Check students table
    RETURN QUERY
    WITH student_stats AS (
        SELECT 
            'students' as table_name,
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE tenant_id = target_tenant_id) as accessible_records,
            ARRAY_AGG(DISTINCT tenant_id::TEXT) FILTER (WHERE tenant_id IS NOT NULL) as sample_tenant_ids
        FROM students
    )
    SELECT * FROM student_stats;
    
    -- Check classes table
    RETURN QUERY
    WITH class_stats AS (
        SELECT 
            'classes' as table_name,
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE tenant_id = target_tenant_id) as accessible_records,
            ARRAY_AGG(DISTINCT tenant_id::TEXT) FILTER (WHERE tenant_id IS NOT NULL) as sample_tenant_ids
        FROM classes
    )
    SELECT * FROM class_stats;
    
    -- Check parents table
    RETURN QUERY
    WITH parent_stats AS (
        SELECT 
            'parents' as table_name,
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE tenant_id = target_tenant_id) as accessible_records,
            ARRAY_AGG(DISTINCT tenant_id::TEXT) FILTER (WHERE tenant_id IS NOT NULL) as sample_tenant_ids
        FROM parents
    )
    SELECT * FROM parent_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update auth.users metadata to include tenant_id
-- This function updates user JWT metadata to include tenant_id
CREATE OR REPLACE FUNCTION update_user_tenant_metadata()
RETURNS VOID AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Update all users in auth.users with tenant_id in app_metadata
    FOR user_record IN 
        SELECT au.id as auth_id, u.tenant_id 
        FROM auth.users au
        JOIN users u ON au.id = u.id
        WHERE u.tenant_id IS NOT NULL
    LOOP
        -- Update app_metadata to include tenant_id
        UPDATE auth.users 
        SET app_metadata = COALESCE(app_metadata, '{}'::jsonb) || 
                          jsonb_build_object('tenant_id', user_record.tenant_id::text)
        WHERE id = user_record.auth_id;
        
        RAISE NOTICE 'Updated auth metadata for user %', user_record.auth_id;
    END LOOP;
    
    RAISE NOTICE '✅ Updated auth metadata for all users';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the metadata update
SELECT update_user_tenant_metadata();

-- 6. Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_students_tenant_id ON students(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_classes_tenant_id ON classes(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parents_tenant_id ON parents(tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- 7. Final verification
DO $$
DECLARE
    total_students INTEGER;
    total_classes INTEGER;
    total_parents INTEGER;
    sample_tenant UUID;
BEGIN
    SELECT COUNT(*) INTO total_students FROM students;
    SELECT COUNT(*) INTO total_classes FROM classes;
    SELECT COUNT(*) INTO total_parents FROM parents;
    SELECT tenant_id INTO sample_tenant FROM students LIMIT 1;
    
    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    RAISE NOTICE '✅ STUDENT DATA ACCESS FIX COMPLETED';
    RAISE NOTICE '=================================================';
    RAISE NOTICE 'Database Summary:';
    RAISE NOTICE '  - Students: %', total_students;
    RAISE NOTICE '  - Classes: %', total_classes;
    RAISE NOTICE '  - Parents: %', total_parents;
    RAISE NOTICE '  - Sample tenant_id: %', sample_tenant;
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Test student queries in your application';
    RAISE NOTICE '2. Ensure users sign in again to get updated JWT tokens';
    RAISE NOTICE '3. Check tenant context is set correctly in your code';
    RAISE NOTICE '4. Use debug_student_access() function to verify access';
    RAISE NOTICE '';
    RAISE NOTICE 'Example usage:';
    RAISE NOTICE '  SELECT * FROM debug_student_access(''user@example.com'');';
END $$;
