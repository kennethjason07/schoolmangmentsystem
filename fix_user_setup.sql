-- SQL Script to Fix User Setup and Foreign Key Constraints
-- Run this script to resolve the created_by foreign key constraint violation

-- First, let's check what users exist in auth.users vs our users table
SELECT 'Auth Users:' as section, id, email, created_at FROM auth.users
UNION ALL
SELECT 'App Users:', id::text, email, created_at FROM users;

-- Create a default admin user in the users table if it doesn't exist
-- This will ensure the foreign key constraint can be satisfied
INSERT INTO users (
  id,
  email, 
  first_name, 
  last_name, 
  role_id, 
  tenant_id, 
  status,
  created_at,
  updated_at
)
SELECT 
  auth_users.id,
  auth_users.email,
  COALESCE(SPLIT_PART(auth_users.email, '@', 1), 'Admin') as first_name,
  'User' as last_name,
  1 as role_id, -- Admin role
  'default-tenant' as tenant_id,
  'Active' as status,
  auth_users.created_at,
  NOW() as updated_at
FROM auth.users auth_users
WHERE NOT EXISTS (
  SELECT 1 FROM users app_users 
  WHERE app_users.id = auth_users.id
);

-- Verify the fix
SELECT 'Verification - Users now in both tables:' as section;
SELECT 
  au.id,
  au.email as auth_email,
  u.email as users_email,
  u.first_name,
  u.last_name,
  u.role_id,
  u.tenant_id
FROM auth.users au
JOIN users u ON au.id = u.id;

-- Also check if we have any orphaned events (events with created_by that don't exist)
SELECT 'Checking for orphaned events:' as section;
SELECT 
  e.id,
  e.title,
  e.created_by,
  CASE 
    WHEN u.id IS NULL THEN 'ORPHANED - User not found'
    ELSE 'OK - User exists'
  END as status
FROM events e
LEFT JOIN users u ON e.created_by = u.id
WHERE e.created_by IS NOT NULL;

-- Fix any orphaned events by setting created_by to NULL 
-- (since the field is likely optional)
UPDATE events 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id FROM users);

-- Show final verification
SELECT 'Final check - All events should now be valid:' as section;
SELECT COUNT(*) as total_events FROM events;
SELECT COUNT(*) as events_with_valid_created_by FROM events e 
JOIN users u ON e.created_by = u.id;
SELECT COUNT(*) as events_with_null_created_by FROM events 
WHERE created_by IS NULL;
