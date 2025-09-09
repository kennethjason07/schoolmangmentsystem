-- Check what tenant ID your user has (or if it's NULL)

SELECT 
  auth.uid() as your_user_id,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid()) as your_tenant_id,
  CASE 
    WHEN (SELECT tenant_id FROM public.users WHERE id = auth.uid()) IS NULL 
    THEN 'NULL - This is the problem!'
    WHEN (SELECT tenant_id FROM public.users WHERE id = auth.uid()) = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid
    THEN 'MATCHES - Should work'
    ELSE 'DIFFERENT - This is why exams are hidden'
  END as diagnosis;
