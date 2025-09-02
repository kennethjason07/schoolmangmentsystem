-- Fix Profile for kenj7214@gmail.com
-- Run this in your Supabase SQL editor (this bypasses RLS)

-- 1. First, check if the default tenant exists
SELECT 'Checking default tenant:' as info;
SELECT id, name, status FROM tenants WHERE id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- 2. Create default tenant if it doesn't exist
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

-- 3. Check current state of the user with email kenj7214@gmail.com
SELECT 'Current user state:' as info;
SELECT id, email, full_name, role_id, tenant_id FROM users WHERE email = 'kenj7214@gmail.com';

4. Option A: If user exists with different ID, update the ID to match auth user
Replace 'YOUR_AUTH_USER_ID' with your actual auth user ID from the app logs
UPDATE users SET 
  id = 'b601fdfe-9800-4c12-a762-e07e5ca57e37',
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE email = 'kenj7214@gmail.com';

5. Option B: If no user exists, create one (uncomment and replace YOUR_AUTH_USER_ID)
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  phone, 
  tenant_id,
  created_at
) VALUES (
  'b601fdfe-9800-4c12-a762-e07e5ca57e37',  -- Replace with actual auth user ID
  'kenj7214@gmail.com',
  'Admin User',
  1,
  '',
  'b8f8b5f0-1234-4567-8901-123456789000',
  NOW()
) ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  tenant_id = EXCLUDED.tenant_id;

-- 6. Verify the fix worked
SELECT 'Final user state:' as info;
SELECT id, email, full_name, role_id, tenant_id FROM users WHERE email = 'kenj7214@gmail.com';
