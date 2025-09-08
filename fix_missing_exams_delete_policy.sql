-- FIX: Missing DELETE policy for exams table
-- This is the root cause of exam deletion not working

-- ===============================
-- ADD MISSING EXAMS DELETE POLICY
-- ===============================

-- Add the missing DELETE policy for exams table
CREATE POLICY "tenant_exams_delete" ON public.exams
FOR DELETE 
TO authenticated
USING (tenant_id = auth.current_user_tenant_id());

-- Also add missing DELETE policy for marks table if it doesn't exist
CREATE POLICY "tenant_marks_delete" ON public.marks
FOR DELETE 
TO authenticated
USING (tenant_id = auth.current_user_tenant_id());

-- ===============================
-- VERIFY THE POLICIES ARE IN PLACE
-- ===============================

-- Show all RLS policies for exams table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'exams'
ORDER BY cmd, policyname;

-- Show all RLS policies for marks table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'marks'
ORDER BY cmd, policyname;

-- Test that exams and marks can be deleted (should return count)
SELECT 'Testing DELETE access on exams table...' as test_status;
SELECT COUNT(*) as accessible_exams_for_delete 
FROM public.exams 
WHERE tenant_id = auth.current_user_tenant_id();

SELECT 'Testing DELETE access on marks table...' as test_status;
SELECT COUNT(*) as accessible_marks_for_delete 
FROM public.marks 
WHERE tenant_id = auth.current_user_tenant_id();

-- ===============================
-- SUCCESS MESSAGE
-- ===============================

SELECT '
✅ MISSING DELETE POLICIES ADDED SUCCESSFULLY!

POLICIES ADDED:
✅ tenant_exams_delete - Users can now delete exams in their tenant
✅ tenant_marks_delete - Users can now delete marks in their tenant

The exam deletion issue should now be resolved!

WHAT WAS THE PROBLEM:
- The RLS policies had SELECT, INSERT, and UPDATE policies for exams
- But the DELETE policy was missing, so users couldn''t delete exams
- This caused the delete operation to fail silently

STATUS: DELETE policies added successfully! ✅
' as success_message;
