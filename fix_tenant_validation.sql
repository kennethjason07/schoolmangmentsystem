-- SQL Script to Fix Tenant Validation Issues
-- Run this in your database console to identify and fix tenant problems

-- 1. Check all tenants and their status
SELECT 
    id, 
    name, 
    status, 
    created_at,
    updated_at
FROM tenants 
ORDER BY created_at DESC;

-- 2. Check users without tenant_id
SELECT 
    id, 
    email, 
    role_id, 
    tenant_id,
    created_at
FROM users 
WHERE tenant_id IS NULL 
ORDER BY created_at DESC;

-- 3. Check users with invalid tenant_id (tenant doesn't exist)
SELECT 
    u.id, 
    u.email, 
    u.tenant_id,
    t.name as tenant_name,
    t.status as tenant_status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.tenant_id IS NOT NULL 
    AND t.id IS NULL;

-- 4. Check users pointing to inactive tenants
SELECT 
    u.id, 
    u.email, 
    u.tenant_id,
    t.name as tenant_name,
    t.status as tenant_status
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE t.status != 'active';

-- 5. Check the specific user from the log (replace with actual user ID)
-- The log shows user: b8f8b5f0-1234-4567-8901-123456789000
SELECT 
    u.id, 
    u.email, 
    u.role_id,
    u.tenant_id,
    t.name as tenant_name,
    t.status as tenant_status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- 6. Check the tenant from the log context
-- The log shows context tenant: acb5595e-a709-4d24-940a-d370f3116171
SELECT 
    id, 
    name, 
    status, 
    created_at
FROM tenants 
WHERE id = 'acb5595e-a709-4d24-940a-d370f3116171';

-- 7. Count notifications for each tenant
SELECT 
    t.name as tenant_name,
    t.id as tenant_id,
    t.status,
    COUNT(n.id) as notification_count
FROM tenants t
LEFT JOIN notifications n ON t.id = n.tenant_id
GROUP BY t.id, t.name, t.status
ORDER BY notification_count DESC;

-- 8. Check notification_recipients for the user
SELECT 
    nr.recipient_id,
    nr.tenant_id,
    nr.recipient_type,
    COUNT(*) as recipient_count,
    t.name as tenant_name
FROM notification_recipients nr
LEFT JOIN tenants t ON nr.tenant_id = t.id
WHERE nr.recipient_id = 'b8f8b5f0-1234-4567-8901-123456789000'
GROUP BY nr.recipient_id, nr.tenant_id, nr.recipient_type, t.name;

-- FIXES (uncomment and run as needed)

-- Fix 1: If user has no tenant_id, assign them to the first active tenant
-- UPDATE users 
-- SET tenant_id = (SELECT id FROM tenants WHERE status = 'active' LIMIT 1)
-- WHERE tenant_id IS NULL 
--   AND id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Fix 2: If tenant is inactive, activate it
-- UPDATE tenants 
-- SET status = 'active', updated_at = NOW()
-- WHERE id = 'acb5595e-a709-4d24-940a-d370f3116171';

-- Fix 3: Create missing tenant if it doesn't exist
-- INSERT INTO tenants (id, name, status, created_at, updated_at)
-- VALUES (
--     'acb5595e-a709-4d24-940a-d370f3116171',
--     'School Management System',
--     'active',
--     NOW(),
--     NOW()
-- );

-- Fix 4: Update user's tenant_id to match context
-- UPDATE users 
-- SET tenant_id = 'acb5595e-a709-4d24-940a-d370f3116171'
-- WHERE id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Fix 5: Clean up orphaned notification_recipients
-- DELETE FROM notification_recipients 
-- WHERE tenant_id NOT IN (SELECT id FROM tenants WHERE status = 'active');

-- Fix 6: Update notification_recipients tenant_id to match user's tenant
-- UPDATE notification_recipients 
-- SET tenant_id = (
--     SELECT tenant_id FROM users 
--     WHERE users.id = notification_recipients.recipient_id
-- )
-- WHERE recipient_id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Verification queries (run after fixes)

-- Verify user has valid tenant
SELECT 
    u.id, 
    u.email, 
    u.tenant_id,
    t.name as tenant_name,
    t.status as tenant_status
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Verify tenant exists and is active
SELECT 
    id, 
    name, 
    status
FROM tenants 
WHERE id = 'acb5595e-a709-4d24-940a-d370f3116171';

-- Verify notification access
SELECT 
    COUNT(*) as notification_count
FROM notification_recipients nr
JOIN tenants t ON nr.tenant_id = t.id
WHERE nr.recipient_id = 'b8f8b5f0-1234-4567-8901-123456789000'
  AND t.status = 'active';