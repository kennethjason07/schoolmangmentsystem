-- FIND THE CORRECT TENANT FOR YOUR USER
-- Run this in Supabase SQL Editor to identify the right tenant

-- Step 1: Check what tenant the current user should be using
SELECT 'CURRENT USER TENANT ASSIGNMENT' as info;
SELECT 
    u.email,
    u.tenant_id as user_tenant_id,
    t.name as assigned_tenant_name,
    t.subdomain as assigned_tenant_subdomain
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'prakash01033@gmail.com';

-- Step 2: Check all available tenants in the system
SELECT 'ALL AVAILABLE TENANTS' as info;
SELECT 
    id,
    name,
    subdomain,
    status,
    contact_email,
    created_at,
    CASE 
        WHEN id = 'b8f8b5f0-1234-4567-8901-123456789000' THEN '← HARDCODED DEFAULT'
        ELSE ''
    END as notes
FROM tenants
ORDER BY created_at;

-- Step 3: Check which tenant has your stationary data
SELECT 'STATIONARY ITEMS BY TENANT' as info;
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(si.id) as item_count,
    STRING_AGG(si.name, ', ') as item_names
FROM tenants t
LEFT JOIN stationary_items si ON t.id = si.tenant_id
GROUP BY t.id, t.name
HAVING COUNT(si.id) > 0
ORDER BY COUNT(si.id) DESC;

-- Step 4: Check which tenant has your purchase data
SELECT 'STATIONARY PURCHASES BY TENANT' as info;
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(sp.id) as purchase_count,
    SUM(sp.total_amount) as total_amount
FROM tenants t
LEFT JOIN stationary_purchases sp ON t.id = sp.tenant_id
GROUP BY t.id, t.name
HAVING COUNT(sp.id) > 0
ORDER BY COUNT(sp.id) DESC;

-- Step 5: Check which tenant has your students/classes
SELECT 'STUDENTS BY TENANT' as info;
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(s.id) as student_count
FROM tenants t
LEFT JOIN students s ON t.id = s.tenant_id
GROUP BY t.id, t.name
HAVING COUNT(s.id) > 0
ORDER BY COUNT(s.id) DESC;

-- Step 6: RECOMMENDATION - Find the tenant with most data
SELECT 'RECOMMENDED TENANT (Most Data)' as info;
WITH tenant_data AS (
    SELECT 
        t.id,
        t.name,
        t.subdomain,
        COALESCE(item_count.cnt, 0) as items,
        COALESCE(purchase_count.cnt, 0) as purchases,
        COALESCE(student_count.cnt, 0) as students,
        (COALESCE(item_count.cnt, 0) + COALESCE(purchase_count.cnt, 0) + COALESCE(student_count.cnt, 0)) as total_data
    FROM tenants t
    LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM stationary_items GROUP BY tenant_id) item_count ON t.id = item_count.tenant_id
    LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM stationary_purchases GROUP BY tenant_id) purchase_count ON t.id = purchase_count.tenant_id
    LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM students GROUP BY tenant_id) student_count ON t.id = student_count.tenant_id
)
SELECT 
    name as recommended_tenant,
    id as recommended_tenant_id,
    subdomain,
    items,
    purchases,
    students,
    total_data,
    CASE 
        WHEN id = 'b8f8b5f0-1234-4567-8901-123456789000' THEN '← Currently using this one (hardcoded)'
        WHEN total_data > 0 THEN '← This tenant has your actual data!'
        ELSE ''
    END as recommendation
FROM tenant_data
ORDER BY total_data DESC;
