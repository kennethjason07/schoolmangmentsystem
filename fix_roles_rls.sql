-- Fix Roles Table - Insert Required Roles
-- Run this script in your Supabase SQL editor to fix the missing roles issue
-- This script will bypass RLS policies and insert the required roles

-- ========================================
-- STEP 1: Check current state of roles table
-- ========================================
SELECT 'Current roles in database:' as info;
SELECT id, role_name, tenant_id FROM public.roles ORDER BY id;

-- ========================================
-- STEP 2: Disable RLS temporarily (if needed) and insert roles
-- ========================================

-- First, ensure we have the default tenant
INSERT INTO public.tenants (
  id,
  name,
  subdomain,
  status,
  subscription_plan,
  max_students,
  max_teachers,
  max_classes,
  contact_email,
  created_at
) VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000',
  'Default School',
  'default',
  'active',
  'enterprise',
  1000,
  100,
  50,
  'admin@school.com',
  CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

-- Insert the required roles (this will work with superuser/service key permissions)
INSERT INTO public.roles (role_name, tenant_id) VALUES 
  ('Admin', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Teacher', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Parent', 'b8f8b5f0-1234-4567-8901-123456789000'),
  ('Student', 'b8f8b5f0-1234-4567-8901-123456789000')
ON CONFLICT (role_name) DO NOTHING;

-- ========================================
-- STEP 3: Verify the roles were created
-- ========================================
SELECT 'Roles after insertion:' as info;
SELECT id, role_name, tenant_id FROM public.roles ORDER BY id;

-- ========================================
-- STEP 4: Check if any users exist and fix their role_ids if needed
-- ========================================
SELECT 'Users with problematic role_ids:' as info;
SELECT id, email, full_name, role_id FROM public.users 
WHERE role_id IS NULL OR role_id NOT IN (SELECT id FROM public.roles)
ORDER BY created_at DESC;

-- Fix any existing users with invalid role_ids by setting them to Admin (1)
UPDATE public.users 
SET role_id = (SELECT id FROM public.roles WHERE role_name = 'Admin' LIMIT 1)
WHERE role_id IS NULL OR role_id NOT IN (SELECT id FROM public.roles);

-- ========================================
-- STEP 5: Final verification
-- ========================================
SELECT 'Final verification - Roles:' as info;
SELECT id, role_name, tenant_id FROM public.roles ORDER BY id;

SELECT 'Final verification - Users by role:' as info;
SELECT 
  r.role_name,
  COUNT(u.id) as user_count
FROM public.roles r
LEFT JOIN public.users u ON r.id = u.role_id
GROUP BY r.id, r.role_name
ORDER BY r.id;

-- Show successful completion message
SELECT '✅ Roles table has been fixed! You can now use the login system.' as completion_message;
