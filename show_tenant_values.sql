-- Show the actual tenant ID values to identify the mismatch

SELECT 
  'Your user tenant ID:' as info,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as tenant_id,
  pg_typeof((SELECT tenant_id FROM public.users WHERE id = auth.uid())) as data_type;

SELECT 
  'Exam tenant IDs:' as info,
  tenant_id,
  pg_typeof(tenant_id) as data_type,
  COUNT(*) as exam_count
FROM public.exams 
GROUP BY tenant_id, pg_typeof(tenant_id);
