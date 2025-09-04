-- Fix User's Missing tenant_id
-- This script will update the current user's tenant_id in the users table

-- Step 1: Check what tenants exist
SELECT 'Available tenants:' as info, id, name, subdomain, status 
FROM tenants 
WHERE status = 'active'
ORDER BY created_at DESC;

-- Step 2: Check current user records without tenant_id
SELECT 'Users without tenant_id:' as info, id, email, full_name, tenant_id
FROM users 
WHERE tenant_id IS NULL;

-- Step 3: Update your specific user account with the correct tenant_id
-- Replace YOUR_USER_EMAIL with your actual login email
-- Replace YOUR_TENANT_ID with the actual tenant ID from Step 1

-- First, let's use the known default tenant ID that matches your schema
UPDATE users 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE email = 'kenj7214@gmail.com' AND tenant_id IS NULL;

-- Step 4: Verify the update worked
SELECT 'Updated user:' as info, u.id, u.email, u.full_name, u.tenant_id, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'kenj7214@gmail.com';

-- Step 5: Create the tenant if it doesn't exist
INSERT INTO tenants (
  id,
  name,
  subdomain,
  status,
  max_students,
  max_teachers,
  max_classes,
  created_at
) VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000',
  'Default School',
  'default',
  'active',
  1000,
  100,
  50,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 6: Final verification
SELECT 'Final check - All users with tenants:' as info, 
       u.email, u.full_name, u.tenant_id, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
ORDER BY u.email;
