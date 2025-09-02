-- Fix Missing User Profile with Tenant ID
-- Run this in your Supabase SQL editor

-- 1. First, check what tenants exist in your system
SELECT id, name, subdomain, status 
FROM tenants 
WHERE status = 'active'
ORDER BY created_at DESC;

-- 2. Create the missing user profile with a tenant_id
-- Replace 'YOUR_TENANT_ID' with an actual tenant ID from the query above
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  phone, 
  tenant_id,
  created_at
) VALUES (
  'b601fdfe-9800-4c12-a762-e07e5ca57e37',
  'kenj7214@gmail.com',
  'Admin User',
  1,
  '',
  'b8f8b5f0-1234-4567-8901-123456789000',  -- Default tenant UUID
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 3. Alternative: If you don't have tenants yet, create one first
INSERT INTO tenants (
  id,
  name,
  subdomain,
  status,
  max_students,
  max_teachers,
  created_at
) VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000',
  'Default School',
  'default',
  'active',
  1000,
  100,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Then create the user profile
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  phone, 
  tenant_id,
  created_at
) VALUES (
  'b601fdfe-9800-4c12-a762-e07e5ca57e37',
  'kenj7214@gmail.com',
  'Admin User',
  1,
  '',
  'b8f8b5f0-1234-4567-8901-123456789000',  -- Uses the tenant created above
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. Verify the user was created successfully
SELECT u.id, u.email, u.full_name, u.role_id, u.tenant_id, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.id = 'b601fdfe-9800-4c12-a762-e07e5ca57e37';
