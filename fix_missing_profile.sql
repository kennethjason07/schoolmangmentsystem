-- Fix Missing User Profile Issue
-- Run this in your Supabase SQL editor

-- 1. Check if the user exists in the users table
SELECT id, email, full_name, role_id, created_at
FROM users 
WHERE id = 'b601fdfe-9800-4c12-a762-e07e5ca57e37';

-- 2. Check all users in the users table
SELECT id, email, full_name, role_id, created_at
FROM users 
ORDER BY created_at DESC;

-- 3. Check auth.users to see if the user exists there
SELECT id, email, created_at, email_confirmed_at
FROM auth.users 
WHERE id = 'b601fdfe-9800-4c12-a762-e07e5ca57e37';

-- 4. If the user doesn't exist in users table, create the missing profile
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role_id, 
  phone, 
  created_at
) VALUES (
  'b601fdfe-9800-4c12-a762-e07e5ca57e37',
  'kenj7214@gmail.com',
  'Admin User',
  1,
  '',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. Verify the user now exists
SELECT id, email, full_name, role_id, created_at
FROM users 
WHERE id = 'b601fdfe-9800-4c12-a762-e07e5ca57e37';

-- 6. Check if there are any other auth users without profiles
SELECT au.id, au.email, au.created_at, u.id as profile_exists
FROM auth.users au
LEFT JOIN users u ON au.id = u.id
WHERE u.id IS NULL
ORDER BY au.created_at DESC;
