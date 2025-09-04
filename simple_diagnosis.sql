-- Simple Diagnostic Queries
-- Run each query separately to identify the issue

-- 1. Check your current user (replace with your actual email)
SELECT 'YOUR USER' as check_type, 
       id as user_id, 
       email, 
       full_name, 
       tenant_id
FROM users 
WHERE email = 'kenedyokumu@gmail.com'; -- CHANGE THIS TO YOUR EMAIL

-- 2. If the above shows a tenant_id, check if that tenant exists
SELECT 'YOUR TENANT' as check_type,
       id as tenant_id,
       name as tenant_name,
       subdomain,
       status
FROM tenants 
WHERE id IN (
    SELECT tenant_id FROM users WHERE email = 'kenedyokumu@gmail.com' -- CHANGE THIS TO YOUR EMAIL
);

-- 3. Check if there are ANY teachers in the database
SELECT 'TOTAL TEACHERS' as check_type, COUNT(*) as count FROM teachers;

-- 4. Check teachers for your specific tenant
SELECT 'YOUR TENANT TEACHERS' as check_type, 
       COUNT(*) as count
FROM teachers 
WHERE tenant_id IN (
    SELECT tenant_id FROM users WHERE email = 'kenedyokumu@gmail.com' -- CHANGE THIS TO YOUR EMAIL
);

-- 5. Check if RLS is enabled on teachers table
SELECT 'RLS STATUS' as check_type,
       'teachers' as table_name,
       CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class 
WHERE relname = 'teachers';
