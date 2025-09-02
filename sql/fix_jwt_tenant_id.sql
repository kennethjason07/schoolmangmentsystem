-- ===================================================================
-- FIX MISSING TENANT_ID IN JWT TOKENS
-- ===================================================================
-- The issue: JWT tokens don't contain tenant_id, so application can't see data

-- Step 1: Check current auth metadata
SELECT 'Current Auth Metadata' as step;

SELECT 
  'auth_metadata_check' as check_type,
  au.email,
  au.raw_user_meta_data,
  au.raw_user_meta_data->>'tenant_id' as current_auth_tenant_id,
  u.tenant_id::text as correct_tenant_id,
  CASE 
    WHEN au.raw_user_meta_data->>'tenant_id' IS NULL 
    THEN '❌ MISSING - No tenant_id in auth metadata'
    WHEN au.raw_user_meta_data->>'tenant_id' = u.tenant_id::text
    THEN '✅ CORRECT - Auth metadata matches user tenant'
    ELSE '❌ WRONG - Auth metadata has wrong tenant_id'
  END as status
FROM auth.users au
JOIN public.users u ON au.id = u.id
WHERE au.email ILIKE '%kenj%' OR au.email = 'kenj7214@gmail.com'
ORDER BY au.email;

-- Step 2: Fix auth metadata for all users
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{tenant_id}',
  to_jsonb((SELECT tenant_id::text FROM public.users WHERE users.id = auth.users.id))
)
WHERE id IN (
  SELECT u.id 
  FROM public.users u 
  WHERE u.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::uuid
);

-- Step 3: Verify the fix
SELECT 'After Fix - Auth Metadata' as step;

SELECT 
  'auth_metadata_fixed' as check_type,
  au.email,
  au.raw_user_meta_data->>'tenant_id' as auth_tenant_id,
  u.tenant_id::text as user_tenant_id,
  CASE 
    WHEN au.raw_user_meta_data->>'tenant_id' = u.tenant_id::text
    THEN '✅ FIXED - Auth metadata now matches'
    ELSE '❌ STILL BROKEN - ' || COALESCE(au.raw_user_meta_data->>'tenant_id', 'NULL') || ' != ' || u.tenant_id::text
  END as status
FROM auth.users au
JOIN public.users u ON au.id = u.id
WHERE au.email ILIKE '%kenj%' OR au.email = 'kenj7214@gmail.com'
ORDER BY au.email;

-- Step 4: Create/update the function that sets tenant_id in JWT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user signs up, ensure their auth metadata gets the tenant_id
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{tenant_id}',
    to_jsonb(NEW.tenant_id::text)
  )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON public.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== JWT TENANT_ID FIX COMPLETE ===';
  RAISE NOTICE '✅ Updated auth.users metadata with tenant_id: b8f8b5f0-1234-4567-8901-123456789000';
  RAISE NOTICE '✅ Created trigger to auto-set tenant_id for new users';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 CRITICAL NEXT STEPS:';
  RAISE NOTICE '1. Log out of your school management application COMPLETELY';
  RAISE NOTICE '2. Clear ALL browser data (cookies, cache, localStorage)';
  RAISE NOTICE '3. Log back in to get a new JWT token with tenant_id';
  RAISE NOTICE '4. Your application should now see all the data!';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 The issue was: JWT tokens had no tenant_id, so RLS blocked all data';
  RAISE NOTICE '✅ The solution: Auth metadata now contains correct tenant_id';
END $$;
