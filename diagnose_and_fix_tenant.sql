-- DIAGNOSE AND FIX TENANT_ID ISSUES
-- Run this in your Supabase SQL Editor

-- Step 1: Check current user accounts and their tenant assignments
SELECT 'CURRENT USER ACCOUNTS AND TENANT ASSIGNMENTS' as info;
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.tenant_id as user_tenant_id,
    t.name as tenant_name,
    t.subdomain,
    t.status as tenant_status,
    CASE 
        WHEN u.tenant_id IS NULL THEN '❌ NO TENANT ASSIGNED'
        WHEN t.id IS NULL THEN '❌ INVALID TENANT_ID'
        WHEN t.status != 'active' THEN '⚠️ INACTIVE TENANT'
        ELSE '✅ VALID TENANT'
    END as status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
ORDER BY u.created_at;

-- Step 2: Check all tenants in the system
SELECT 'ALL TENANTS IN SYSTEM' as info;
SELECT 
    id,
    name,
    subdomain,
    status,
    max_students,
    max_teachers,
    created_at
FROM tenants
ORDER BY created_at;

-- Step 3: Check stationary data by tenant
SELECT 'STATIONARY ITEMS BY TENANT' as info;
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(si.id) as items_count,
    STRING_AGG(si.name, ', ') as item_names
FROM tenants t
LEFT JOIN stationary_items si ON t.id = si.tenant_id
GROUP BY t.id, t.name
ORDER BY t.name;

-- Step 4: Check stationary purchases by tenant
SELECT 'STATIONARY PURCHASES BY TENANT' as info;
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    COUNT(sp.id) as purchases_count,
    SUM(sp.total_amount) as total_revenue
FROM tenants t
LEFT JOIN stationary_purchases sp ON t.id = sp.tenant_id
GROUP BY t.id, t.name
ORDER BY t.name;

-- Step 5: Identify the issue
SELECT 'ISSUE IDENTIFICATION' as info;

-- Check users without tenant_id
SELECT 
    'Users without tenant_id' as issue_type,
    COUNT(*) as count
FROM users 
WHERE tenant_id IS NULL;

-- Check users with invalid tenant_id
SELECT 
    'Users with invalid tenant_id' as issue_type,
    COUNT(*) as count
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.tenant_id IS NOT NULL AND t.id IS NULL;

-- Step 6: RECOMMENDED FIXES
-- Uncomment ONE of the options below based on your situation:

-- OPTION 1: If you have only one tenant and want to assign all users to it
-- UPDATE users 
-- SET tenant_id = (SELECT id FROM tenants WHERE status = 'active' LIMIT 1)
-- WHERE tenant_id IS NULL;

-- OPTION 2: If you have a specific tenant you want to use (replace with your tenant ID)
-- UPDATE users 
-- SET tenant_id = 'YOUR_TENANT_ID_HERE'
-- WHERE tenant_id IS NULL OR tenant_id NOT IN (SELECT id FROM tenants WHERE status = 'active');

-- OPTION 3: Create a default tenant and assign all users to it
-- INSERT INTO tenants (id, name, subdomain, status, max_students, max_teachers, max_classes)
-- VALUES (gen_random_uuid(), 'Default School', 'default', 'active', 1000, 100, 50)
-- ON CONFLICT (subdomain) DO NOTHING;

-- UPDATE users 
-- SET tenant_id = (SELECT id FROM tenants WHERE subdomain = 'default')
-- WHERE tenant_id IS NULL;

-- Step 7: Verify the fix
SELECT 'VERIFICATION AFTER FIX' as info;
SELECT 
    u.email,
    u.tenant_id,
    t.name as tenant_name,
    CASE 
        WHEN u.tenant_id IS NOT NULL AND t.id IS NOT NULL THEN '✅ FIXED'
        ELSE '❌ STILL BROKEN'
    END as fix_status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id;

-- Step 8: Test stationary data access for a specific user (replace email)
-- SELECT 'TESTING STATIONARY ACCESS FOR SPECIFIC USER' as info;
-- WITH user_tenant AS (
--     SELECT tenant_id FROM users WHERE email = 'YOUR_EMAIL_HERE'
-- )
-- SELECT 
--     'Stationary Items' as data_type,
--     COUNT(*) as count
-- FROM stationary_items si, user_tenant ut
-- WHERE si.tenant_id = ut.tenant_id
-- UNION ALL
-- SELECT 
--     'Stationary Purchases' as data_type,
--     COUNT(*) as count
-- FROM stationary_purchases sp, user_tenant ut
-- WHERE sp.tenant_id = ut.tenant_id;
