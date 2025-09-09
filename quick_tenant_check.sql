-- Quick check to find the tenant mismatch issue

SELECT 
  'USER TENANT:' as type,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as tenant_id;

SELECT 
  'EXAM TENANTS:' as type,
  tenant_id,
  COUNT(*) as count
FROM public.exams 
GROUP BY tenant_id;

-- Test if they match
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN 'MATCH: Exams should be visible'
    ELSE 'NO MATCH: This is why exams are hidden'
  END as diagnosis
FROM public.exams 
WHERE tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());
