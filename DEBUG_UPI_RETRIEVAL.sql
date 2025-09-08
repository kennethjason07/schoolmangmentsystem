-- Debug UPI retrieval issue
-- Check if the current user can see UPI settings and what tenant_id they have

-- 1. Check current user's tenant_id
SELECT 
  'Current User Info' as section,
  auth.uid() as current_user_id,
  u.tenant_id as user_tenant_id,
  u.email,
  u.full_name
FROM public.users u 
WHERE u.id = auth.uid();

-- 2. Check all UPI settings for current user's tenant
SELECT 
  'UPI Settings for Current Tenant' as section,
  s.*
FROM public.school_upi_settings s
WHERE s.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid());

-- 3. Check what the UPI service query should return (primary and active)
SELECT 
  'Primary UPI ID Query Result' as section,
  s.*
FROM public.school_upi_settings s
WHERE s.tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  AND s.is_active = true
ORDER BY s.is_primary DESC, s.created_at DESC
LIMIT 1;

-- 4. Check if there are any UPI settings at all
SELECT 
  'All UPI Settings (Debug)' as section,
  s.tenant_id,
  s.upi_id,
  s.upi_name,
  s.is_primary,
  s.is_active
FROM public.school_upi_settings s;

-- 5. Test if RLS is working by trying to access other tenant's data
SELECT 
  'RLS Test - Should only show current tenant data' as section,
  COUNT(*) as visible_records
FROM public.school_upi_settings;
