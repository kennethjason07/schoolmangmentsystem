-- IMMEDIATE FIX FOR TENANT ASSIGNMENT ISSUE
-- Run this in your Supabase SQL Editor to fix tenant assignments immediately

-- Step 1: Check current state
SELECT 'BEFORE FIX - Current State' as status;

-- Show users without tenant_id
SELECT 
    email,
    tenant_id,
    CASE 
        WHEN tenant_id IS NULL THEN 'NO TENANT ASSIGNED ❌'
        ELSE 'HAS TENANT ✅'
    END as status
FROM users;

-- Show available tenants
SELECT 
    id,
    name,
    subdomain,
    status
FROM tenants
WHERE status = 'active';

-- Step 2: Create default tenant if none exists
INSERT INTO tenants (
    id,
    name,
    subdomain,
    status,
    max_students,
    max_teachers,
    max_classes,
    subscription_plan,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'My School',
    'myschool',
    'active',
    1000,
    100,
    50,
    'basic',
    NOW(),
    NOW()
) ON CONFLICT (subdomain) DO NOTHING;

-- Step 3: Get the tenant ID we'll use (first active tenant)
DO $$
DECLARE
    target_tenant_id UUID;
BEGIN
    -- Get first active tenant ID
    SELECT id INTO target_tenant_id
    FROM tenants 
    WHERE status = 'active' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Update all users without tenant_id to use this tenant
    UPDATE users 
    SET tenant_id = target_tenant_id,
        updated_at = NOW()
    WHERE tenant_id IS NULL;
    
    -- Also update users with invalid tenant_ids
    UPDATE users 
    SET tenant_id = target_tenant_id,
        updated_at = NOW()
    WHERE tenant_id NOT IN (SELECT id FROM tenants WHERE status = 'active');
    
    RAISE NOTICE 'Assigned all users to tenant: %', target_tenant_id;
END $$;

-- Step 4: Verify the fix
SELECT 'AFTER FIX - Updated State' as status;

SELECT 
    u.email,
    u.tenant_id,
    t.name as tenant_name,
    t.subdomain,
    CASE 
        WHEN u.tenant_id IS NOT NULL AND t.id IS NOT NULL THEN 'FIXED ✅'
        ELSE 'STILL BROKEN ❌'
    END as fix_status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id;

-- Step 5: Test stationary data access
SELECT 'STATIONARY DATA BY TENANT' as status;

SELECT 
    t.name as tenant_name,
    COUNT(DISTINCT si.id) as stationary_items,
    COUNT(DISTINCT sp.id) as stationary_purchases,
    COUNT(DISTINCT u.id) as users_assigned
FROM tenants t
LEFT JOIN stationary_items si ON t.id = si.tenant_id
LEFT JOIN stationary_purchases sp ON t.id = sp.tenant_id
LEFT JOIN users u ON t.id = u.tenant_id
WHERE t.status = 'active'
GROUP BY t.id, t.name;

-- Success message
SELECT 'TENANT ASSIGNMENT FIXED! ✅' as result;
SELECT 'Now restart your app and try the Stationary Management again.' as instruction;
