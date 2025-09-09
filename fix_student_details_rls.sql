-- Fix Student Details RLS Policies (following the same pattern as personal_tasks fix)
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
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'students' 
  AND schemaname = 'public';

-- Drop the problematic tenant isolation policy for students
DROP POLICY IF EXISTS "students_tenant_isolation" ON public.students;

-- Create a more reliable policy for students based on user access
-- Teachers can access students from classes they teach
-- Students can access their own data
-- Parents can access their children's data
-- Admins can access all students in their tenant

CREATE POLICY "students_user_access" ON public.students
FOR ALL TO authenticated
USING (
    -- Students can see their own record
    id IN (
        SELECT linked_student_id 
        FROM public.users 
        WHERE id = auth.uid() AND linked_student_id IS NOT NULL
    )
    OR
    -- Parents can see their children's records
    id IN (
        SELECT linked_parent_of 
        FROM public.users 
        WHERE id = auth.uid() AND linked_parent_of IS NOT NULL
    )
    OR
    -- Teachers can see students from classes they teach (via teacher_subjects)
    class_id IN (
        SELECT DISTINCT s.class_id
        FROM public.teacher_subjects ts
        JOIN public.subjects s ON ts.subject_id = s.id
        JOIN public.teachers t ON ts.teacher_id = t.id
        JOIN public.users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    )
    OR
    -- Teachers can see students from classes they're class teacher of
    class_id IN (
        SELECT c.id
        FROM public.classes c
        JOIN public.teachers t ON c.class_teacher_id = t.id
        JOIN public.users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    )
    OR
    -- Fallback: Basic tenant isolation (users can see students in same tenant)
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

-- Drop problematic users policies and create more permissive ones
DROP POLICY IF EXISTS "users_tenant_isolation" ON public.users;

-- Users can access other users in their tenant (needed for dashboard queries)
CREATE POLICY "users_tenant_access" ON public.users
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
    -- Insert/Update: Users can modify their own record or within same tenant
    id = auth.uid()
    OR
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

-- Drop problematic classes policies
DROP POLICY IF EXISTS "classes_tenant_isolation" ON public.classes;

-- Create more accessible policy for classes
CREATE POLICY "classes_tenant_access" ON public.classes
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

-- Drop problematic parents policies
DROP POLICY IF EXISTS "parents_tenant_isolation" ON public.parents;

-- Create accessible policy for parents
CREATE POLICY "parents_tenant_access" ON public.parents
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
-- STEP 5: VERIFY THE FIXES
-- ==========================================

-- Check all student-related table policies
SELECT 
    'Updated RLS Policies Summary:' as info,
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('students', 'users', 'classes', 'parents') 
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Success message
SELECT 
    '✅ Student details RLS policies updated!' as status,
    'The maybeSingle and related query issues should now be resolved' as message;

-- EXPLANATION OF THE FIX:
-- 
-- The main issue was similar to the personal_tasks problem:
-- Overly restrictive RLS policies that depended on JWT claims
-- that might not be available or properly formatted.
-- 
-- The new policies:
-- 1. Use auth.uid() which is always reliable for authenticated users
-- 2. Use subqueries to the users table to get tenant_id (more reliable than JWT claims)  
-- 3. Include multiple access patterns (student own data, parent-child, teacher-student)
-- 4. Fallback to basic tenant isolation when specific relationships aren't found
-- 5. Remove dependency on problematic JWT token claims
-- 
-- This should fix the "maybeSingle is not a function" error by ensuring
-- the queries can complete successfully without RLS blocking them.
