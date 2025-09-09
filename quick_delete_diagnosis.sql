-- Quick diagnosis to identify why exam deletion fails

-- 1. Check RLS policies for exams
SELECT 'Current RLS policies for exams:' as info;
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'exams' AND schemaname = 'public';

-- 2. Check if exam still exists
SELECT 'Does the exam still exist?' as info;
SELECT COUNT(*) as exam_exists, 'Should be 0 if deleted' as note
FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa';

-- 3. Check current user's tenant
SELECT 'Current user tenant:' as info;
SELECT 
  auth.uid() as user_id,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as user_tenant;

-- 4. Try manual delete and see what happens
SELECT 'Attempting manual delete now:' as info;

DELETE FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa'
AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- 5. Check result
SELECT 'Delete result:' as info;
SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: Exam was deleted'
    ELSE 'FAILED: Exam still exists'
  END as result
FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa';
