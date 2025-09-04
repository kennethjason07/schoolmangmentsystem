-- RLS Policies for Fee Management Tables
-- Run this in Supabase SQL Editor to enable fee management functionality
-- This fixes the issue where teachers/admins can't fetch data due to RLS policies

-- ========================================
-- STEP 1: Enable RLS on all fee-related tables
-- ========================================

-- Enable Row Level Security on all fee-related tables
ALTER TABLE IF EXISTS public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.fee_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_discounts ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: Classes Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS classes_select ON public.classes;
DROP POLICY IF EXISTS classes_insert ON public.classes;
DROP POLICY IF EXISTS classes_update ON public.classes;
DROP POLICY IF EXISTS classes_delete ON public.classes;

-- Allow authenticated users to access classes within their tenant
CREATE POLICY classes_select ON public.classes 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = classes.tenant_id)
);

CREATE POLICY classes_insert ON public.classes 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = classes.tenant_id)
);

CREATE POLICY classes_update ON public.classes 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = classes.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = classes.tenant_id)
);

CREATE POLICY classes_delete ON public.classes 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = classes.tenant_id)
);

-- ========================================
-- STEP 3: Students Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS students_select ON public.students;
DROP POLICY IF EXISTS students_insert ON public.students;
DROP POLICY IF EXISTS students_update ON public.students;
DROP POLICY IF EXISTS students_delete ON public.students;

-- Allow authenticated users to access students within their tenant
CREATE POLICY students_select ON public.students 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = students.tenant_id)
);

CREATE POLICY students_insert ON public.students 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = students.tenant_id)
);

CREATE POLICY students_update ON public.students 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = students.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = students.tenant_id)
);

CREATE POLICY students_delete ON public.students 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = students.tenant_id)
);

-- ========================================
-- STEP 4: Fee Structure Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS fee_structure_select ON public.fee_structure;
DROP POLICY IF EXISTS fee_structure_insert ON public.fee_structure;
DROP POLICY IF EXISTS fee_structure_update ON public.fee_structure;
DROP POLICY IF EXISTS fee_structure_delete ON public.fee_structure;

-- Allow authenticated users to access fee structures within their tenant
CREATE POLICY fee_structure_select ON public.fee_structure 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = fee_structure.tenant_id)
);

CREATE POLICY fee_structure_insert ON public.fee_structure 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = fee_structure.tenant_id)
);

CREATE POLICY fee_structure_update ON public.fee_structure 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = fee_structure.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = fee_structure.tenant_id)
);

CREATE POLICY fee_structure_delete ON public.fee_structure 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = fee_structure.tenant_id)
);

-- ========================================
-- STEP 5: Student Fees Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS student_fees_select ON public.student_fees;
DROP POLICY IF EXISTS student_fees_insert ON public.student_fees;
DROP POLICY IF EXISTS student_fees_update ON public.student_fees;
DROP POLICY IF EXISTS student_fees_delete ON public.student_fees;

-- Allow authenticated users to access student fees within their tenant
CREATE POLICY student_fees_select ON public.student_fees 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_fees.tenant_id)
);

CREATE POLICY student_fees_insert ON public.student_fees 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_fees.tenant_id)
);

CREATE POLICY student_fees_update ON public.student_fees 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_fees.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_fees.tenant_id)
);

CREATE POLICY student_fees_delete ON public.student_fees 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_fees.tenant_id)
);

-- ========================================
-- STEP 6: Student Discounts Table RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS student_discounts_select ON public.student_discounts;
DROP POLICY IF EXISTS student_discounts_insert ON public.student_discounts;
DROP POLICY IF EXISTS student_discounts_update ON public.student_discounts;
DROP POLICY IF EXISTS student_discounts_delete ON public.student_discounts;

-- Allow authenticated users to access student discounts within their tenant
CREATE POLICY student_discounts_select ON public.student_discounts 
FOR SELECT TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_discounts.tenant_id)
);

CREATE POLICY student_discounts_insert ON public.student_discounts 
FOR INSERT TO authenticated 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_discounts.tenant_id)
);

CREATE POLICY student_discounts_update ON public.student_discounts 
FOR UPDATE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_discounts.tenant_id)
) 
WITH CHECK (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_discounts.tenant_id)
);

CREATE POLICY student_discounts_delete ON public.student_discounts 
FOR DELETE TO authenticated 
USING (
    (auth.jwt() ? 'tenant_id' AND (auth.jwt()->>'tenant_id')::uuid = tenant_id) 
    OR 
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.tenant_id = student_discounts.tenant_id)
);

-- ========================================
-- STEP 7: Verify the setup
-- ========================================

-- Check which tables have RLS enabled
SELECT 'RLS Status for Fee Management Tables:' as info;
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('classes', 'students', 'fee_structure', 'student_fees', 'student_discounts')
AND schemaname = 'public'
ORDER BY tablename;

-- Show all RLS policies for fee management tables
SELECT 'Fee Management RLS Policies:' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    SUBSTRING(qual, 1, 100) as condition_preview
FROM pg_policies 
WHERE tablename IN ('classes', 'students', 'fee_structure', 'student_fees', 'student_discounts')
ORDER BY tablename, policyname;

-- Test access to each table
SELECT 'Testing table access:' as info;

SELECT 'Classes accessible:' as table_name, COUNT(*) as count 
FROM public.classes
UNION ALL
SELECT 'Students accessible:', COUNT(*) 
FROM public.students
UNION ALL
SELECT 'Fee Structure accessible:', COUNT(*) 
FROM public.fee_structure
UNION ALL
SELECT 'Student Fees accessible:', COUNT(*) 
FROM public.student_fees
UNION ALL
SELECT 'Student Discounts accessible:', COUNT(*) 
FROM public.student_discounts;

-- Show success message
SELECT '✅ Fee Management RLS policies created successfully!' as completion_message;
SELECT '🎉 Fee Management should now work properly for all authenticated users!' as final_message;
SELECT '📋 Teachers and Admins can now access all fee-related data within their tenant!' as tenant_message;
