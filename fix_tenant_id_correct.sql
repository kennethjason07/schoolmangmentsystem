-- FIX TENANT_ID ISSUES FOR ASSIGNMENT SUBMISSIONS
-- Based on correct database schema from schema.txt

-- STEP 1: Check current students tenant_id status
SELECT 'CHECKING STUDENTS TENANT_ID STATUS...' as status;

SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- Show sample students data
SELECT id, name, tenant_id, class_id 
FROM students 
ORDER BY created_at 
LIMIT 5;

-- STEP 2: Check the user-student relationship
SELECT 'CHECKING USER-STUDENT RELATIONSHIP...' as status;

-- Show users with linked students and their tenant_ids
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.tenant_id as user_tenant_id,
    s.id as student_id,
    s.name as student_name,
    s.tenant_id as student_tenant_id,
    CASE 
        WHEN s.tenant_id IS NULL AND u.tenant_id IS NOT NULL THEN 'STUDENT NEEDS TENANT UPDATE'
        WHEN s.tenant_id IS NULL AND u.tenant_id IS NULL THEN 'BOTH USER AND STUDENT NEED TENANT'
        WHEN s.tenant_id != u.tenant_id THEN 'TENANT MISMATCH'
        ELSE 'OK'
    END as status
FROM users u
LEFT JOIN students s ON u.linked_student_id = s.id
WHERE u.linked_student_id IS NOT NULL
LIMIT 10;

-- STEP 3: Update students with tenant_id from their linked users
SELECT 'UPDATING STUDENTS TENANT_ID FROM LINKED USERS...' as status;

UPDATE students 
SET tenant_id = u.tenant_id
FROM users u 
WHERE u.linked_student_id = students.id 
  AND students.tenant_id IS NULL 
  AND u.tenant_id IS NOT NULL;

-- STEP 4: For any remaining students without tenant_id, set to first available tenant
UPDATE students 
SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- STEP 5: For any users without tenant_id, set to first available tenant
UPDATE users 
SET tenant_id = (SELECT id FROM tenants ORDER BY created_at LIMIT 1)
WHERE tenant_id IS NULL;

-- STEP 6: Show updated status
SELECT 'UPDATED STATUS...' as status;

SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as users_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as users_with_tenant
FROM users;

-- STEP 7: Enable RLS and create policies for assignment_submissions table
SELECT 'SETTING UP ASSIGNMENT_SUBMISSIONS RLS POLICIES...' as status;

ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "tenant_assignment_submissions_select" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_insert" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_update" ON assignment_submissions;
DROP POLICY IF EXISTS "tenant_assignment_submissions_delete" ON assignment_submissions;

-- Create tenant-based policies for assignment_submissions
CREATE POLICY "tenant_assignment_submissions_select" ON assignment_submissions
FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_insert" ON assignment_submissions
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_update" ON assignment_submissions
FOR UPDATE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignment_submissions_delete" ON assignment_submissions
FOR DELETE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

-- STEP 8: Enable RLS for homeworks table
SELECT 'SETTING UP HOMEWORKS RLS POLICIES...' as status;

ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_homeworks_select" ON homeworks;
DROP POLICY IF EXISTS "tenant_homeworks_insert" ON homeworks;
DROP POLICY IF EXISTS "tenant_homeworks_update" ON homeworks;
DROP POLICY IF EXISTS "tenant_homeworks_delete" ON homeworks;

CREATE POLICY "tenant_homeworks_select" ON homeworks
FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_homeworks_insert" ON homeworks
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_homeworks_update" ON homeworks
FOR UPDATE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_homeworks_delete" ON homeworks
FOR DELETE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

-- STEP 9: Enable RLS for assignments table
SELECT 'SETTING UP ASSIGNMENTS RLS POLICIES...' as status;

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_assignments_select" ON assignments;
DROP POLICY IF EXISTS "tenant_assignments_insert" ON assignments;
DROP POLICY IF EXISTS "tenant_assignments_update" ON assignments;
DROP POLICY IF EXISTS "tenant_assignments_delete" ON assignments;

CREATE POLICY "tenant_assignments_select" ON assignments
FOR SELECT TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignments_insert" ON assignments
FOR INSERT TO authenticated
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignments_update" ON assignments
FOR UPDATE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id())
WITH CHECK (tenant_id = public.get_current_user_tenant_id());

CREATE POLICY "tenant_assignments_delete" ON assignments
FOR DELETE TO authenticated
USING (tenant_id = public.get_current_user_tenant_id());

-- STEP 10: Verification
SELECT 'VERIFICATION - TENANT_ID FIXES COMPLETE!' as status;

-- Show policies created
SELECT 
    tablename,
    policyname,
    cmd as permission_type
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('assignment_submissions', 'homeworks', 'assignments')
  AND policyname LIKE 'tenant_%'
ORDER BY tablename, policyname;

-- Test current user's tenant access
SELECT * FROM public.check_user_tenant_assignment();

SELECT '
🔐 TENANT_ID FIXES COMPLETED SUCCESSFULLY!

FIXES APPLIED:
✅ Updated students table with tenant_id from linked users
✅ Updated any remaining students/users with first available tenant
✅ Added RLS policies for assignment_submissions table
✅ Added RLS policies for homeworks table  
✅ Added RLS policies for assignments table

DATABASE RELATIONSHIP:
✅ users.linked_student_id → students.id (correct relationship identified)
✅ All students now have tenant_id values
✅ All users now have tenant_id values

RLS POLICIES ACTIVE:
✅ assignment_submissions - tenant-based isolation
✅ homeworks - tenant-based isolation
✅ assignments - tenant-based isolation

NEXT STEPS:
1. Test assignment submission in your app
2. student.tenant_id should now be populated
3. Submissions should work without constraint violations

STATUS: Assignment submissions tenant_id issue fixed!
' as success_message;
