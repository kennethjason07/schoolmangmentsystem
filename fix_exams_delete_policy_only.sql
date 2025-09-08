-- FIX: Add only the missing DELETE policy for exams table
-- This fixes the root cause of exam deletion not working

-- ===============================
-- ADD MISSING EXAMS DELETE POLICY ONLY
-- ===============================

-- Add the missing DELETE policy for exams table
-- The marks table already has its DELETE policy
CREATE POLICY "tenant_exams_delete" ON public.exams
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

-- ===============================
-- SUCCESS MESSAGE
-- ===============================

SELECT '
✅ MISSING EXAMS DELETE POLICY ADDED SUCCESSFULLY!

POLICY ADDED:
✅ tenant_exams_delete - Users can now delete exams in their tenant

The exam deletion issue should now be resolved!

WHAT WAS THE PROBLEM:
- The RLS policies had SELECT, INSERT, and UPDATE policies for exams
- But the DELETE policy was missing, so users couldn''t delete exams
- This caused the delete operation to fail silently
- The marks table already had its DELETE policy

Now try deleting an exam again - it should work!

STATUS: Exams DELETE policy added successfully! ✅
' as success_message;
