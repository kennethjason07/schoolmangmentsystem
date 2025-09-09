-- Simple diagnosis to understand why exams are not visible

-- 1. Check if exams still exist
SELECT COUNT(*) as total_exams, 'Total exams in database' as info
FROM public.exams;

-- 2. Check current user's tenant ID
SELECT 
  auth.uid() as current_user,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as user_tenant_id,
  'Current user info' as info;

-- 3. Show sample exam tenant IDs
SELECT 
  tenant_id,
  COUNT(*) as exam_count,
  'Exams by tenant' as info
FROM public.exams 
GROUP BY tenant_id;

-- 4. Test policy condition manually
SELECT 
  COUNT(*) as matching_exams,
  'Exams that should be visible' as info
FROM public.exams e
WHERE e.tenant_id = (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid());

-- 5. Show current policies
SELECT 
  policyname,
  cmd,
  'Current exam policies' as info
FROM pg_policies 
WHERE tablename = 'exams' AND schemaname = 'public';
