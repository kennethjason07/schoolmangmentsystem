-- Update JWT metadata to include tenant_id
-- This ensures the user's JWT token contains the tenant_id

-- Update the auth.users metadata with tenant_id
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}')::jsonb || 
    jsonb_build_object('tenant_id', 'b8f8b5f0-1234-4567-8901-123456789000')
WHERE email = 'kenj7214@gmail.com';

-- Verify the update
SELECT 
    email,
    raw_app_meta_data,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'kenj7214@gmail.com';

-- Also check the public users table to ensure everything is aligned
SELECT 
    'Public users table:' as info,
    u.email, 
    u.tenant_id, 
    t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'kenj7214@gmail.com';
