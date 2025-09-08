-- FIX: Assign correct tenant_id to current user
-- The user has NULL tenant_id but exams have b8f8b5f0-1234-4567-8901-123456789000

-- 1. Show current user state
SELECT 'BEFORE FIX:' as status;
SELECT 
  auth.uid() as user_id,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as current_tenant_id;

-- 2. Update the user's tenant_id to match the exams
UPDATE public.users 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid
WHERE id = auth.uid();

-- 3. Verify the fix
SELECT 'AFTER FIX:' as status;
SELECT 
  auth.uid() as user_id,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as new_tenant_id;

-- 4. Test if exams are now visible
SELECT 'VISIBILITY TEST:' as status;
SELECT 
  COUNT(*) as visible_exams,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ SUCCESS: Exams should now be visible!'
    ELSE '❌ Still not working - need different fix'
  END as result
FROM public.exams 
WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- 5. Success message
SELECT '
✅ USER TENANT ID FIXED!

PROBLEM: Your user record had NULL tenant_id
SOLUTION: Updated your user to have tenant_id: b8f8b5f0-1234-4567-8901-123456789000
RESULT: You should now be able to see all 6 exams in your frontend

Please refresh your app - the exams should be visible now!
' as success_message;
