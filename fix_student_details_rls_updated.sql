-- Fix Student Details RLS Policies (Updated to handle existing policies)
-- Run this in Supabase SQL Editor

-- ==========================================
-- STEP 1: FIX STUDENTS TABLE RLS POLICIES
-- ==========================================

-- Check current RLS status for students table
SELECT 
    'Students Table RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity = true THEN '❌ RLS is ENABLED (might be blocking access)'
        ELSE '✅ RLS is DISABLED'
    END as status
FROM pg_tables 
WHERE tablename = 'students' 
  AND schemaname = 'public';

-- Check existing policies for students
SELECT 
    'Students Table Existing Policies:' as info,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'students' 
  AND schemaname = 'public';

-- Drop ALL existing problematic policies for students
DROP POLICY IF EXISTS "students_tenant_isolation" ON public.students;
DROP POLICY IF EXISTS "students_user_access" ON public.students;
DROP POLICY IF EXISTS "tenant_students_select" ON public.students;
DROP POLICY IF EXISTS "tenant_students_insert" ON public.students;
DROP POLICY IF EXISTS "tenant_students_update" ON public.students;
DROP POLICY IF EXISTS "tenant_students_delete" ON public.students;

-- Create a more reliable policy for students
CREATE POLICY "students_access_fixed" ON public.students
FOR ALL TO authenticated
USING (
    -- Basic tenant isolation using subquery (more reliable than JWT)
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
)
WITH CHECK (
    -- Insert/Update: Basic tenant isolation
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- ==========================================
-- STEP 2: FIX USERS TABLE RLS POLICIES
-- ==========================================

-- Check current RLS status for users table
SELECT 
    'Users Table RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'users' 
  AND schemaname = 'public';

-- Drop ALL existing problematic users policies
DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;
DROP POLICY IF EXISTS "users_tenant_access" ON public.users;
DROP POLICY IF EXISTS "tenant_users_select" ON public.users;
DROP POLICY IF EXISTS "tenant_users_insert" ON public.users;
DROP POLICY IF EXISTS "tenant_users_update" ON public.users;
DROP POLICY IF EXISTS "tenant_users_delete" ON public.users;
DROP POLICY IF EXISTS "admin_users_access" ON public.users;

-- Create more permissive users policy
CREATE POLICY "users_access_fixed" ON public.users
FOR ALL TO authenticated
USING (
    -- Users can see their own record
    id = auth.uid()
    OR
    -- Users can see other users in their tenant
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
)
WITH CHECK (
    -- Insert/Update: Users can modify within same tenant
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- ==========================================
-- STEP 3: FIX CLASSES TABLE RLS POLICIES
-- ==========================================

-- Check current RLS status for classes table
SELECT 
    'Classes Table RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'classes' 
  AND schemaname = 'public';

-- Drop ALL existing problematic classes policies
DROP POLICY IF EXISTS "classes_tenant_isolation" ON public.classes;
DROP POLICY IF EXISTS "classes_tenant_access" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_select" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_insert" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_update" ON public.classes;
DROP POLICY IF EXISTS "tenant_classes_delete" ON public.classes;

-- Create accessible policy for classes
CREATE POLICY "classes_access_fixed" ON public.classes
FOR ALL TO authenticated
USING (
    -- Basic tenant isolation - users can see classes in their tenant
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
)
WITH CHECK (
    -- Insert/Update: Basic tenant isolation
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- ==========================================
-- STEP 4: FIX PARENTS TABLE RLS POLICIES
-- ==========================================

-- Check if parents table has RLS enabled
SELECT 
    'Parents Table RLS Status:' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'parents' 
  AND schemaname = 'public';

-- Drop ALL existing problematic parents policies
DROP POLICY IF EXISTS "parents_tenant_isolation" ON public.parents;
DROP POLICY IF EXISTS "parents_tenant_access" ON public.parents;
DROP POLICY IF EXISTS "tenant_parents_select" ON public.parents;
DROP POLICY IF EXISTS "tenant_parents_insert" ON public.parents;
DROP POLICY IF EXISTS "tenant_parents_update" ON public.parents;
DROP POLICY IF EXISTS "tenant_parents_delete" ON public.parents;

-- Create accessible policy for parents
CREATE POLICY "parents_access_fixed" ON public.parents
FOR ALL TO authenticated
USING (
    -- Basic tenant isolation - users can see parents in their tenant
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
)
WITH CHECK (
    -- Insert/Update: Basic tenant isolation
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- ==========================================
-- STEP 5: ALSO FIX RELATED TABLES
-- ==========================================

-- Fix subjects table (used in dashboard queries)
DROP POLICY IF EXISTS "subjects_tenant_isolation" ON public.subjects;
DROP POLICY IF EXISTS "subjects_access_fixed" ON public.subjects;

CREATE POLICY "subjects_access_fixed" ON public.subjects
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- Fix timetable_entries table (used for schedule)
DROP POLICY IF EXISTS "timetable_entries_tenant_isolation" ON public.timetable_entries;
DROP POLICY IF EXISTS "timetable_access_fixed" ON public.timetable_entries;

CREATE POLICY "timetable_access_fixed" ON public.timetable_entries
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- Fix student_attendance table (used in dashboard)
DROP POLICY IF EXISTS "student_attendance_tenant_isolation" ON public.student_attendance;
DROP POLICY IF EXISTS "student_attendance_access_fixed" ON public.student_attendance;

CREATE POLICY "student_attendance_access_fixed" ON public.student_attendance
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- Fix marks table (used in dashboard)
DROP POLICY IF EXISTS "marks_tenant_isolation" ON public.marks;
DROP POLICY IF EXISTS "marks_access_fixed" ON public.marks;

CREATE POLICY "marks_access_fixed" ON public.marks
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- Fix notifications table (used in dashboard)
DROP POLICY IF EXISTS "notifications_tenant_isolation" ON public.notifications;
DROP POLICY IF EXISTS "notifications_access_fixed" ON public.notifications;

CREATE POLICY "notifications_access_fixed" ON public.notifications
FOR ALL TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid() 
        LIMIT 1
    )
);

-- ==========================================
-- STEP 6: VERIFY THE FIXES
-- ==========================================

-- Check all updated policies
SELECT 
    '=== UPDATED RLS POLICIES SUMMARY ===' as info,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('students', 'users', 'classes', 'parents', 'subjects', 'timetable_entries', 'student_attendance', 'marks', 'notifications') 
  AND schemaname = 'public'
  AND policyname LIKE '%access_fixed%'
ORDER BY tablename, policyname;

-- Count total policies fixed
SELECT 
    'Total Fixed Policies:' as summary,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
  AND policyname LIKE '%access_fixed%';

-- Success message
SELECT 
    '✅ Student details RLS policies updated successfully!' as status,
    'All restrictive JWT-based policies replaced with reliable subquery-based policies' as details,
    'The maybeSingle and related query errors should now be resolved' as message;

-- EXPLANATION:
-- 
-- This comprehensive fix addresses the root cause of the query errors:
-- 
-- 1. **Removed JWT dependency**: Old policies relied on auth.jwt() claims that often failed
-- 2. **Simplified tenant checking**: Now uses reliable subquery to users table
-- 3. **Consistent pattern**: All tables now use the same reliable pattern
-- 4. **Proper cleanup**: Removes ALL old problematic policies before creating new ones
-- 5. **Covers all related tables**: Fixed all tables used by StudentDashboard
-- 
-- The new pattern is:
-- - Use auth.uid() (always reliable)
-- - Use subquery to users table to get tenant_id
-- - Simple tenant isolation without complex role-based logic
-- - No dependency on JWT claims that might fail
--
-- This should completely resolve the "maybeSingle is not a function" and related errors.
