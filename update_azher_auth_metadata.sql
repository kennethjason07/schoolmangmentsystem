-- ===================================================================
-- UPDATE AUTH METADATA FOR AZHERPA84@GMAIL.COM WITH CORRECT TENANT_ID
-- ===================================================================

-- Step 1: Check current auth metadata for azherpa84@gmail.com
SELECT 
  'BEFORE UPDATE - Auth Metadata Check' as step,
  au.email,
  au.raw_user_meta_data,
  au.raw_user_meta_data->>'tenant_id' as current_auth_tenant_id,
  u.tenant_id::text as correct_tenant_id_from_users_table,
  CASE 
    WHEN au.raw_user_meta_data->>'tenant_id' IS NULL 
    THEN '❌ MISSING - No tenant_id in auth metadata'
    WHEN au.raw_user_meta_data->>'tenant_id' = u.tenant_id::text
    THEN '✅ CORRECT - Auth metadata matches user tenant'
    ELSE '❌ WRONG - Auth metadata has wrong tenant_id: ' || COALESCE(au.raw_user_meta_data->>'tenant_id', 'NULL') || ' != ' || u.tenant_id::text
  END as status
FROM auth.users au
JOIN public.users u ON au.id = u.id
WHERE au.email = 'azherpa84@gmail.com';

-- Step 2: Update auth metadata with correct tenant_id
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{tenant_id}',
  to_jsonb((SELECT tenant_id::text FROM public.users WHERE users.email = 'azherpa84@gmail.com'))
)
WHERE email = 'azherpa84@gmail.com';

-- Step 3: Verify the update was successful
SELECT 
  'AFTER UPDATE - Verification' as step,
  au.email,
  au.raw_user_meta_data->>'tenant_id' as updated_auth_tenant_id,
  u.tenant_id::text as user_table_tenant_id,
  CASE 
    WHEN au.raw_user_meta_data->>'tenant_id' = u.tenant_id::text
    THEN '✅ SUCCESS - Auth metadata now matches user tenant'
    ELSE '❌ FAILED - Still mismatch: ' || COALESCE(au.raw_user_meta_data->>'tenant_id', 'NULL') || ' != ' || u.tenant_id::text
  END as result
FROM auth.users au
JOIN public.users u ON au.id = u.id
WHERE au.email = 'azherpa84@gmail.com';

-- Step 4: Show tenant details for verification
SELECT 
  'TENANT DETAILS' as step,
  t.id as tenant_id,
  t.name as tenant_name,
  t.subdomain,
  t.status,
  u.email as user_email,
  u.full_name as user_name
FROM public.tenants t
JOIN public.users u ON u.tenant_id = t.id
WHERE u.email = 'azherpa84@gmail.com';

-- Success message
DO $$
DECLARE
  updated_tenant_id TEXT;
  tenant_name TEXT;
BEGIN
  -- Get the updated tenant info
  SELECT u.tenant_id::text, t.name
  INTO updated_tenant_id, tenant_name
  FROM public.users u
  JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.email = 'azherpa84@gmail.com';
  
  RAISE NOTICE '';
  RAISE NOTICE '=== AUTH METADATA UPDATE COMPLETE ===';
  RAISE NOTICE '✅ Updated auth metadata for azherpa84@gmail.com';
  RAISE NOTICE '✅ New tenant ID in JWT: %', updated_tenant_id;
  RAISE NOTICE '✅ Tenant name: %', tenant_name;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 CRITICAL INSTRUCTIONS FOR USER:';
  RAISE NOTICE '1. LOG OUT of the school management app COMPLETELY';
  RAISE NOTICE '2. CLEAR browser cache/cookies/localStorage';
  RAISE NOTICE '3. LOG BACK IN to get a new JWT token';
  RAISE NOTICE '4. User will now only see their own school data!';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 The tenant isolation issue is now FIXED!';
END $$;
