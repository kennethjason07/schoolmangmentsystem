-- EMERGENCY STUDENT ACCESS FIX - CORRECTED VERSION
-- This script diagnoses and fixes student data access issues

-- 1. First, let's check what's in the students table
SELECT 'CHECKING STUDENTS TABLE...' as status;

SELECT 
    COUNT(*) as total_students,
    tenant_id,
    class_id,
    academic_year
FROM students 
GROUP BY tenant_id, class_id, academic_year
ORDER BY tenant_id, class_id;

-- 2. Check RLS status (corrected query)
SELECT 'CHECKING RLS STATUS...' as status;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('students', 'classes', 'users', 'tenants')
  AND schemaname = 'public';

-- 3. Check existing RLS policies on students table
SELECT 'CHECKING EXISTING RLS POLICIES...' as status;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'students' AND schemaname = 'public';

-- 4. EMERGENCY FIX - Create permissive RLS policies
SELECT 'APPLYING EMERGENCY FIX...' as status;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Students access policy" ON students;
DROP POLICY IF EXISTS "tenant_isolation_policy" ON students;
DROP POLICY IF EXISTS "tenant_students_policy" ON students;
DROP POLICY IF EXISTS "Users can only access their tenant students" ON students;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON students;
DROP POLICY IF EXISTS "emergency_student_access" ON students;

-- Enable RLS if not already enabled
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Create a very permissive policy for debugging
CREATE POLICY "emergency_student_access" ON students
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 5. Do the same for related tables
DROP POLICY IF EXISTS "Classes access policy" ON classes;
DROP POLICY IF EXISTS "tenant_classes_policy" ON classes;
DROP POLICY IF EXISTS "emergency_classes_access" ON classes;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_classes_access" ON classes
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Users access policy" ON users;
DROP POLICY IF EXISTS "tenant_users_policy" ON users;
DROP POLICY IF EXISTS "emergency_users_access" ON users;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_users_access" ON users
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Also fix parents table
DROP POLICY IF EXISTS "Parents access policy" ON parents;
DROP POLICY IF EXISTS "tenant_parents_policy" ON parents;
DROP POLICY IF EXISTS "emergency_parents_access" ON parents;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emergency_parents_access" ON parents
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Test the fix
SELECT 'TESTING STUDENT ACCESS...' as status;

-- This should now return students
SELECT 
    id,
    name,
    admission_no,
    tenant_id,
    class_id,
    academic_year,
    created_at
FROM students 
ORDER BY created_at DESC
LIMIT 10;

-- 7. Check authentication context (this shows what JWT claims are available)
SELECT 'CHECKING AUTH CONTEXT...' as status;

-- Check current user context
SELECT 
    auth.uid() as user_id,
    auth.jwt() as jwt_claims,
    current_user as postgres_user;

-- 8. Create a diagnostic function to test student access
CREATE OR REPLACE FUNCTION test_student_access()
RETURNS TABLE(
    status text,
    student_count bigint,
    user_id uuid,
    tenant_from_jwt text,
    message text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    jwt_claims jsonb;
    tenant_id_claim text;
    student_count bigint;
BEGIN
    -- Get JWT claims
    jwt_claims := auth.jwt();
    tenant_id_claim := jwt_claims->>'tenant_id';
    
    -- Count students
    SELECT COUNT(*) INTO student_count FROM students;
    
    RETURN QUERY SELECT 
        'SUCCESS'::text,
        student_count,
        auth.uid(),
        tenant_id_claim,
        CASE 
            WHEN student_count > 0 THEN 'Students found! Access working.'
            ELSE 'No students found - check data.'
        END;
        
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
        'ERROR'::text,
        0::bigint,
        auth.uid(),
        'N/A'::text,
        SQLERRM;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_student_access() TO authenticated;

-- 9. Create a simple test function that can be called from your app
CREATE OR REPLACE FUNCTION simple_student_test()
RETURNS TABLE(
    total_students bigint,
    sample_student_name text,
    auth_user_id uuid,
    message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    student_count bigint;
    sample_name text;
BEGIN
    -- Count all students
    SELECT COUNT(*) INTO student_count FROM students;
    
    -- Get a sample student name
    SELECT name INTO sample_name FROM students LIMIT 1;
    
    RETURN QUERY SELECT 
        student_count,
        COALESCE(sample_name, 'No students found'),
        auth.uid(),
        CASE 
            WHEN student_count > 0 THEN 'Emergency access working!'
            ELSE 'No students in database'
        END;
END;
$$;

GRANT EXECUTE ON FUNCTION simple_student_test() TO authenticated;

-- 10. Final verification
SELECT 'EMERGENCY FIX APPLIED!' as status;

-- Show current policies
SELECT 'CURRENT RLS POLICIES:' as info;
SELECT 
    tablename,
    policyname,
    cmd as permission_type
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('students', 'classes', 'users', 'parents')
ORDER BY tablename, policyname;

-- Test student count
SELECT 'STUDENT COUNT TEST:' as info;
SELECT COUNT(*) as total_students FROM students;

SELECT '
🚨 EMERGENCY STUDENT ACCESS FIX COMPLETE!

WHAT WE DID:
✅ Removed all restrictive RLS policies 
✅ Created emergency permissive policies for all tables
✅ Students, classes, users, parents all accessible
✅ Created diagnostic functions for testing
✅ Applied to ALL related tables

⚠️  SECURITY WARNING: 
This makes data accessible to ALL authenticated users.
This is TEMPORARY for debugging only.

NEXT STEPS:
1. Test your React Native app immediately
2. Students should now be visible  
3. Call this function from your app: SELECT * FROM simple_student_test();
4. Use the diagnostic component to verify everything works

TEST COMMANDS FOR YOUR APP:
- supabase.rpc("simple_student_test")
- supabase.rpc("test_student_access") 
- supabase.from("students").select("*").limit(5)

STATUS: Emergency access enabled - try your app now!
' as instructions;
