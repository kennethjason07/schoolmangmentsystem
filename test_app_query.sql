-- Test the exact query pattern your app is using and find conflicts

-- 1. Test what your app does: SELECT + explicit tenant_id filter
SELECT 'APP QUERY TEST:' as info;
SELECT COUNT(*) as app_query_result
FROM public.exams
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;

-- 2. Test what RLS policy does: just SELECT (policy adds filter)
SELECT 'RLS POLICY TEST:' as info;
SELECT COUNT(*) as rls_policy_result
FROM public.exams;

-- 3. Check if there's a conflict between app filter and RLS policy
SELECT 'CONFLICT CHECK:' as info;
SELECT 
  CASE 
    WHEN auth.uid() IS NULL THEN 'ERROR: No authenticated user'
    WHEN (SELECT tenant_id FROM public.users WHERE id = auth.uid()) IS NULL THEN 'ERROR: User has NULL tenant_id'
    WHEN (SELECT tenant_id FROM public.users WHERE id = auth.uid()) = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid THEN 'MATCH: Should work'
    ELSE 'MISMATCH: This is the problem'
  END as diagnosis;

-- 4. Show current user's tenant_id for comparison
SELECT 'CURRENT USER TENANT:' as info,
  auth.uid() as user_id,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as user_tenant_id;
