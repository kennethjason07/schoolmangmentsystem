-- ⚠️  EMERGENCY RLS BYPASS - TEMPORARY SOLUTION
-- This script temporarily disables Row Level Security to allow immediate student access
-- WARNING: This removes all security temporarily - use only for debugging!

-- Step 1: Check current RLS status
SELECT 
    tablename, 
    rowsecurity as rls_enabled,
    CASE WHEN rowsecurity THEN '🔒 RLS ENABLED (BLOCKING)' ELSE '🔓 RLS DISABLED (OPEN)' END as status
FROM pg_tables 
WHERE tablename IN ('students', 'classes', 'parents', 'users')
  AND schemaname = 'public';

-- Step 2: Count existing data
SELECT 
    'students' as table_name, 
    COUNT(*) as record_count,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as with_tenant_id
FROM students
UNION ALL
SELECT 
    'classes', 
    COUNT(*), 
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END)
FROM classes
UNION ALL  
SELECT 
    'parents', 
    COUNT(*), 
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END)
FROM parents;

-- Step 3: EMERGENCY BYPASS - Disable RLS temporarily
-- Uncomment the lines below to disable RLS (WARNING: Removes all security!)

-- ⚠️  DANGER ZONE - ONLY UNCOMMENT IF ABSOLUTELY NECESSARY
-- ALTER TABLE students DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE classes DISABLE ROW LEVEL SECURITY;  
-- ALTER TABLE parents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- ✅ SAFER OPTION - Create permissive policies instead
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "tenant_students_policy" ON students;
DROP POLICY IF EXISTS "tenant_classes_policy" ON classes;
DROP POLICY IF EXISTS "tenant_parents_policy" ON parents;
DROP POLICY IF EXISTS "tenant_users_policy" ON users;

-- Create very permissive policies that allow authenticated users access
CREATE POLICY "emergency_students_access" ON students
    FOR ALL 
    USING (
        auth.uid() IS NOT NULL  -- Any authenticated user can access
    );

CREATE POLICY "emergency_classes_access" ON classes
    FOR ALL
    USING (
        auth.uid() IS NOT NULL
    );

CREATE POLICY "emergency_parents_access" ON parents
    FOR ALL
    USING (
        auth.uid() IS NOT NULL
    );

CREATE POLICY "emergency_users_access" ON users
    FOR ALL
    USING (
        auth.uid() IS NOT NULL
    );

-- Ensure RLS is enabled with our permissive policies
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 4: Test the access immediately
SELECT 'Testing student access after policy update...' as status;

-- This should now work for any authenticated user
SELECT 
    id, 
    name, 
    admission_no, 
    tenant_id,
    'SUCCESS - Students accessible' as result
FROM students 
LIMIT 5;

SELECT 
    id, 
    class_name, 
    section,
    tenant_id,
    'SUCCESS - Classes accessible' as result
FROM classes 
LIMIT 5;

-- Step 5: Instructions for next steps
SELECT '
🎉 EMERGENCY BYPASS APPLIED SUCCESSFULLY!

WHAT THIS DID:
- Replaced restrictive RLS policies with permissive ones
- Any authenticated user can now access students, classes, parents
- Security is still enabled, just more permissive

IMMEDIATE ACTIONS:
1. Test student access in your React Native app
2. Students should now load properly
3. All student details should be accessible

AFTER TESTING (IMPORTANT):
1. Run the proper fix script (fix_rls_students_emergency.sql)
2. Update RLS policies to be tenant-specific
3. Have users sign out and back in
4. Test with proper tenant filtering

TEMPORARY NATURE:
- This is a temporary fix for debugging
- Proper tenant-based RLS should be restored
- All authenticated users can access all data currently

TO RESTORE PROPER SECURITY LATER:
- Run the comprehensive RLS fix script
- Update JWT tokens with tenant_id
- Test tenant-specific access

STATUS: Student data should now be accessible in your app!
' as instructions;

-- Step 6: Create a function to easily restore proper RLS later
CREATE OR REPLACE FUNCTION restore_proper_rls()
RETURNS TEXT AS $$
BEGIN
    -- This function can be called later to restore tenant-based RLS
    DROP POLICY IF EXISTS "emergency_students_access" ON students;
    DROP POLICY IF EXISTS "emergency_classes_access" ON classes;
    DROP POLICY IF EXISTS "emergency_parents_access" ON parents;
    DROP POLICY IF EXISTS "emergency_users_access" ON users;
    
    RETURN 'Emergency policies removed. Run proper RLS setup script now.';
END;
$$ LANGUAGE plpgsql;

SELECT '
🛠️  RESTORATION FUNCTION CREATED
To restore proper tenant-based RLS later, run:
SELECT restore_proper_rls();

Then run your comprehensive RLS fix script.
' as restore_info;
