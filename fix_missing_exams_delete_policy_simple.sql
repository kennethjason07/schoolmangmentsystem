-- FIX: Missing DELETE policy for exams table (Simple Version)
-- This fixes the root cause of exam deletion not working
-- Uses direct database lookup instead of auth.current_user_tenant_id()

-- ===============================
-- ADD MISSING EXAMS DELETE POLICY
-- ===============================

-- Add the missing DELETE policy for exams table
-- Uses the same pattern as your working SELECT queries
CREATE POLICY "tenant_exams_delete" ON public.exams
FOR DELETE 
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- Also add missing DELETE policy for marks table if it doesn't exist
CREATE POLICY "tenant_marks_delete" ON public.marks
FOR DELETE 
TO authenticated
USING (
  tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
);

-- ===============================
-- VERIFY THE POLICIES ARE IN PLACE
-- ===============================

-- Show all RLS policies for exams table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd as operation,
    qual as condition
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'exams'
ORDER BY cmd, policyname;

-- Show all RLS policies for marks table  
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd as operation,
    qual as condition
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'marks'
ORDER BY cmd, policyname;

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

Now try deleting an exam again - it should work!

STATUS: DELETE policies added successfully! ✅
' as success_message;
