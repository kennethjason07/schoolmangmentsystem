-- Check Teachers Data and Tenant Setup
-- Run these queries in your Supabase SQL Editor to debug the issue

-- 1. Check all tenants in the system
SELECT 'TENANTS' as table_name, id, name, subdomain, status, created_at 
FROM tenants 
ORDER BY created_at DESC;

-- 2. Check all users and their tenant assignments
SELECT 'USERS' as table_name, id, email, full_name, tenant_id, created_at
FROM users 
ORDER BY created_at DESC;

-- 3. Check total teachers in database (all tenants)
SELECT 'TOTAL TEACHERS' as info, COUNT(*) as count
FROM teachers;

-- 4. Check teachers by tenant
SELECT 'TEACHERS BY TENANT' as info, tenant_id, COUNT(*) as teacher_count
FROM teachers 
GROUP BY tenant_id
ORDER BY teacher_count DESC;

-- 5. Check all teachers with details
SELECT 'ALL TEACHERS' as table_name, id, name, phone, tenant_id, created_at
FROM teachers 
ORDER BY created_at DESC;

-- 6. Check classes by tenant
SELECT 'CLASSES BY TENANT' as info, tenant_id, COUNT(*) as class_count
FROM classes 
GROUP BY tenant_id
ORDER BY class_count DESC;

-- 7. Check subjects by tenant
SELECT 'SUBJECTS BY TENANT' as info, tenant_id, COUNT(*) as subject_count
FROM subjects 
GROUP BY tenant_id
ORDER BY subject_count DESC;

-- 8. Check RLS policies on teachers table
SELECT 'RLS POLICIES' as info, schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'teachers';

-- 9. Check if RLS is enabled on teachers table
SELECT 'RLS STATUS' as info, relname as table_name, relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname IN ('teachers', 'classes', 'subjects', 'users', 'tenants');

-- 10. Find users without tenant_id (potential issue)
SELECT 'USERS WITHOUT TENANT' as issue, id, email, full_name, tenant_id
FROM users 
WHERE tenant_id IS NULL;

-- 11. Check if there are any teachers without tenant_id
SELECT 'TEACHERS WITHOUT TENANT' as issue, id, name, tenant_id
FROM teachers 
WHERE tenant_id IS NULL;
