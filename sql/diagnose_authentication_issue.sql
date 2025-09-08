-- ==========================================
-- AUTHENTICATION ISSUE DIAGNOSIS SCRIPT
-- ==========================================
--
-- This script diagnoses why auth.uid() returns null and exam deletion fails
-- Run this in Supabase SQL Editor AFTER logging into your app
--
-- ==========================================
-- STEP 1: CHECK BASIC AUTH STATE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '   AUTHENTICATION DIAGNOSIS STARTING';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
END $$;

-- Test 1: Check if auth.uid() is working
SELECT 
  'AUTH.UID() TEST' as test_name,
  auth.uid() as auth_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'FAILED - auth.uid() returns NULL'
    ELSE 'SUCCESS - auth.uid() returns: ' || auth.uid()::text
  END as result;

-- Test 2: Check if auth.role() is working  
SELECT 
  'AUTH.ROLE() TEST' as test_name,
  auth.role() as auth_role,
  CASE 
    WHEN auth.role() IS NULL THEN 'FAILED - auth.role() returns NULL'
    ELSE 'SUCCESS - auth.role() returns: ' || auth.role()
  END as result;

-- Test 3: Check JWT contents
SELECT 
  'JWT TOKEN TEST' as test_name,
  auth.jwt() as full_jwt,
  CASE 
    WHEN auth.jwt() IS NULL THEN 'FAILED - No JWT token available'
    WHEN auth.jwt() = '{}'::jsonb THEN 'FAILED - Empty JWT token'
    ELSE 'SUCCESS - JWT token exists'
  END as result;

-- ==========================================
-- STEP 2: DETAILED JWT CLAIMS ANALYSIS
-- ==========================================

-- Test 4: Extract all JWT claims
SELECT 
  'JWT CLAIMS ANALYSIS' as analysis,
  jsonb_pretty(auth.jwt()) as jwt_contents;

-- Test 5: Check for specific JWT fields
SELECT 
  'SPECIFIC JWT FIELDS' as test_category,
  auth.jwt() ->> 'aud' as audience,
  auth.jwt() ->> 'exp' as expires_at,
  auth.jwt() ->> 'sub' as subject_user_id,
  auth.jwt() ->> 'email' as email,
  auth.jwt() ->> 'tenant_id' as tenant_id_claim,
  auth.jwt() -> 'app_metadata' ->> 'tenant_id' as app_metadata_tenant_id,
  auth.jwt() -> 'user_metadata' ->> 'tenant_id' as user_metadata_tenant_id;

-- ==========================================  
-- STEP 3: DATABASE USER LOOKUP
-- ==========================================

-- Test 6: Find users in database and compare with auth
WITH auth_info AS (
  SELECT 
    auth.uid() as auth_user_id,
    auth.jwt() ->> 'email' as auth_email,
    auth.jwt() ->> 'sub' as jwt_subject
)
SELECT 
  'USER LOOKUP TEST' as test_name,
  a.auth_user_id,
  a.auth_email,
  a.jwt_subject,
  u.id as db_user_id,
  u.email as db_email,
  u.tenant_id as db_tenant_id,
  u.role_id as db_role_id,
  CASE 
    WHEN a.auth_user_id IS NULL THEN 'CRITICAL: auth.uid() is NULL'
    WHEN u.id IS NULL AND a.auth_email IS NOT NULL THEN 'ERROR: User exists in auth but not in users table'
    WHEN u.id IS NOT NULL AND a.auth_user_id = u.id THEN 'SUCCESS: User IDs match perfectly'
    WHEN u.id IS NOT NULL AND a.auth_user_id != u.id THEN 'ERROR: User ID mismatch between auth and database'
    ELSE 'UNKNOWN STATE'
  END as diagnosis
FROM auth_info a
LEFT JOIN public.users u ON (u.id = a.auth_user_id OR u.email = a.auth_email);

-- ==========================================
-- STEP 4: TEST TENANT ACCESS FUNCTIONS
-- ==========================================

-- Test 7: Check tenant access functions
SELECT 
  'TENANT FUNCTION TEST' as test_name,
  public.get_current_tenant_id() as current_tenant_function_result,
  CASE 
    WHEN public.get_current_tenant_id() IS NULL THEN 'FAILED - get_current_tenant_id() returns NULL'
    ELSE 'SUCCESS - Tenant ID: ' || public.get_current_tenant_id()::text
  END as result;

-- Test 8: Test if we can access debug function
SELECT 
  'DEBUG JWT FUNCTION TEST' as test_name,
  claim_name,
  claim_value,
  source
FROM public.debug_jwt_claims()
ORDER BY claim_name;

-- ==========================================
-- STEP 5: TEST RLS POLICY IMPACT
-- ==========================================

-- Test 9: Check exam table access
SELECT 
  'EXAM TABLE RLS TEST' as test_name,
  COUNT(*) as exam_count_with_rls,
  CASE 
    WHEN COUNT(*) = 0 THEN 'FAILED - RLS blocking all exam access'
    ELSE 'SUCCESS - Can access ' || COUNT(*)::text || ' exams'
  END as result
FROM public.exams;

-- Test 10: Check exam table access without RLS (admin only)
-- This will show if data exists but RLS is blocking it
SELECT 
  'TOTAL EXAM COUNT' as test_name,
  (SELECT COUNT(*) FROM public.exams) as total_exams_in_db,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.exams) = 0 THEN 'No exam data in database'
    ELSE 'Database contains ' || (SELECT COUNT(*) FROM public.exams)::text || ' exams total'
  END as result;

-- ==========================================
-- STEP 6: TEST SPECIFIC USER SCENARIOS
-- ==========================================

-- Test 11: Check if there are users with the problematic email
SELECT 
  'SPECIFIC USER TEST' as test_name,
  id,
  email,
  tenant_id,
  role_id,
  created_at
FROM public.users 
WHERE email ILIKE '%kenj7214@gmail.com%'
   OR email ILIKE '%kenj%'
ORDER BY created_at DESC;

-- Test 12: Check tenant data
SELECT 
  'TENANT DATA TEST' as test_name,
  id,
  name,
  status,
  subdomain
FROM public.tenants
WHERE status = 'active'
ORDER BY created_at;

-- ==========================================
-- STEP 7: RECOMMENDATIONS
-- ==========================================

DO $$
DECLARE
  auth_uid_result uuid;
  user_count integer;
  exam_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '          DIAGNOSIS SUMMARY';
  RAISE NOTICE '===========================================';
  
  -- Check auth.uid()
  auth_uid_result := auth.uid();
  IF auth_uid_result IS NULL THEN
    RAISE NOTICE '🚨 CRITICAL ISSUE: auth.uid() returns NULL';
    RAISE NOTICE '   This means no user is authenticated or JWT is invalid';
  ELSE
    RAISE NOTICE '✅ auth.uid() works: %', auth_uid_result;
  END IF;
  
  -- Check user data
  SELECT COUNT(*) INTO user_count FROM public.users;
  RAISE NOTICE '📊 Total users in database: %', user_count;
  
  -- Check exam data  
  SELECT COUNT(*) INTO exam_count FROM public.exams;
  RAISE NOTICE '📊 Total exams accessible with current auth: %', exam_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '🎯 LIKELY SOLUTIONS:';
  IF auth_uid_result IS NULL THEN
    RAISE NOTICE '1. User needs to log out and log back in completely';
    RAISE NOTICE '2. Check if JWT token contains proper user ID';
    RAISE NOTICE '3. Verify Supabase client is sending auth headers';
    RAISE NOTICE '4. Temporarily disable RLS for testing if needed';
  ELSE
    RAISE NOTICE '1. Check if user record exists in users table';
    RAISE NOTICE '2. Verify tenant_id is properly assigned';
    RAISE NOTICE '3. Check RLS policies are working correctly';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '        DIAGNOSIS COMPLETE';
  RAISE NOTICE '===========================================';
END $$;
