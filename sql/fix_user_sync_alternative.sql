-- Alternative Fix: Update AuthContext to handle existing user record
-- Run this in your Supabase SQL editor

-- 1. Check the current user record
SELECT 'Current user record:' as info;
SELECT id, email, full_name, role_id, tenant_id FROM users WHERE email = 'kenj7214@gmail.com';

-- 2. Ensure the existing user has proper tenant_id and role_id
UPDATE users SET 
  tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000',
  role_id = CASE 
    WHEN role_id IS NULL OR role_id NOT IN (1, 2, 3, 4) THEN 1 
    ELSE role_id 
  END
WHERE email = 'kenj7214@gmail.com';

-- 3. Verify the user record is now properly configured
SELECT 'Updated user record:' as info;
SELECT id, email, full_name, role_id, tenant_id FROM users WHERE email = 'kenj7214@gmail.com';

-- 4. Now we need to update Supabase Auth user ID to match the database user ID
-- Get the database user ID that we need to sync with
SELECT 'Database user ID to sync auth with:' as info;
SELECT id FROM users WHERE email = 'kenj7214@gmail.com';

-- IMPORTANT: Copy the ID from the result above and use it to update your auth user
-- You'll need to either:
-- A) Update the auth user in Supabase Auth dashboard, OR
-- B) Update the app to use the existing database user ID
