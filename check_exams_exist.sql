-- Check if exams still exist after our fixes

-- 1. Check total exams in database
SELECT 'TOTAL EXAMS IN DATABASE:' as info, COUNT(*) as count FROM public.exams;

-- 2. Check exams by tenant_id
SELECT 'EXAMS BY TENANT:' as info, tenant_id, COUNT(*) as count 
FROM public.exams 
GROUP BY tenant_id;

-- 3. Check if our target exam was deleted
SELECT 'SPECIFIC EXAM CHECK:' as info, 
       CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'DELETED' END as status
FROM public.exams 
WHERE id = '10955ce9-acad-4506-823f-7919472cedaa';

-- 4. Test direct SELECT with your tenant
SELECT 'DIRECT SELECT TEST:' as info, COUNT(*) as visible_exams
FROM public.exams 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;

-- 5. Show sample exams if any exist
SELECT 'SAMPLE EXAMS:' as info, id, name, tenant_id
FROM public.exams 
LIMIT 3;
