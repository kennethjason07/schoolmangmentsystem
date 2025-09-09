-- Diagnose why exams are not visible after policy update

-- 1. Check if exams still exist in the database (bypassing RLS)
SELECT 'Checking if exams exist (bypassing RLS):' as info;
SELECT COUNT(*) as total_exams FROM public.exams;

-- 2. Check current user's tenant ID
SELECT 'Current user tenant ID:' as info;
SELECT 
  auth.uid() as current_user,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as user_tenant_id;

-- 3. Show sample exam data with tenant IDs
SELECT 'Sample exams with tenant IDs:' as info;
SELECT 
  id, 
  name, 
  tenant_id,
  'Sample exam' as note
FROM public.exams 
LIMIT 5;

-- 4. Check tenant ID types (string vs UUID)
SELECT 'Checking tenant ID data types:' as info;
SELECT 
  'From exams table:' as source,
  tenant_id,
  pg_typeof(tenant_id) as data_type
FROM public.exams 
LIMIT 1
UNION ALL
SELECT 
  'From users table:' as source,
  tenant_id,
  pg_typeof(tenant_id) as data_type
FROM public.users 
WHERE id = auth.uid()
LIMIT 1;

-- 5. Test the SELECT policy condition manually
SELECT 'Testing SELECT policy condition:' as info;
SELECT 
  COUNT(*) as matching_exams,
  'Exams matching policy condition' as note
FROM public.exams e
WHERE e.tenant_id = (SELECT u.tenant_id FROM public.users u WHERE u.id = auth.uid());

-- 6. Show current SELECT policy
SELECT 'Current SELECT policy:' as info;
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'exams' AND cmd = 'SELECT' AND schemaname = 'public';
