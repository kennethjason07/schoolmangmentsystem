-- ===================================================================
-- SIMPLE DATA ACCESS DIAGNOSIS
-- ===================================================================
-- Check why application can't see data (schema-agnostic version)

-- Step 1: Check current session context
SELECT 'Session Context Check' as step;

SELECT 
  'current_session' as check_type,
  current_user as database_user,
  current_setting('request.jwt.claim.sub', true) as session_user_id,
  current_setting('request.jwt.claim.tenant_id', true) as session_tenant_id,
  CASE 
    WHEN current_setting('request.jwt.claim.tenant_id', true) IS NULL 
    THEN '❌ No tenant_id in session'
    ELSE '✅ Has tenant_id: ' || current_setting('request.jwt.claim.tenant_id', true)
  END as tenant_status;

-- Step 2: Check user tenant assignment
SELECT 'User Tenant Check' as step;

SELECT 
  'user_tenant_assignment' as check_type,
  email,
  tenant_id as user_database_tenant,
  current_setting('request.jwt.claim.tenant_id', true) as session_tenant,
  CASE 
    WHEN tenant_id::text = current_setting('request.jwt.claim.tenant_id', true) 
    THEN '✅ MATCH'
    ELSE '❌ MISMATCH - DB: ' || tenant_id::text || ', Session: ' || COALESCE(current_setting('request.jwt.claim.tenant_id', true), 'NULL')
  END as alignment_status
FROM public.users 
WHERE email ILIKE '%kenj%' OR email ILIKE '%abhi%' OR email = 'kenj7214@gmail.com'
ORDER BY email;

-- Step 3: Test table visibility (simple counts)
SELECT 'Table Visibility Test' as step;

-- Count visible records in each table
SELECT 'school_details' as table_name, COUNT(*) as visible_records FROM public.school_details
UNION ALL
SELECT 'students' as table_name, COUNT(*) as visible_records FROM public.students
UNION ALL  
SELECT 'classes' as table_name, COUNT(*) as visible_records FROM public.classes
UNION ALL
SELECT 'teachers' as table_name, COUNT(*) as visible_records FROM public.teachers
UNION ALL
SELECT 'users' as table_name, COUNT(*) as visible_records FROM public.users;

-- Step 4: Check RLS status
SELECT 'RLS Status Check' as step;

SELECT 
  'rls_status' as check_type,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled' 
  END as status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('school_details', 'students', 'classes', 'teachers', 'users')
ORDER BY tablename;

-- Step 5: Check auth metadata
SELECT 'Auth Metadata Check' as step;

SELECT 
  'auth_metadata' as check_type,
  au.email,
  au.raw_user_meta_data->>'tenant_id' as auth_tenant_id,
  u.tenant_id::text as db_tenant_id,
  CASE 
    WHEN (au.raw_user_meta_data->>'tenant_id') = u.tenant_id::text 
    THEN '✅ MATCH'
    ELSE '❌ MISMATCH - Auth: ' || COALESCE(au.raw_user_meta_data->>'tenant_id', 'NULL') || ', DB: ' || u.tenant_id::text
  END as metadata_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email ILIKE '%kenj%' OR au.email ILIKE '%abhi%' OR au.email = 'kenj7214@gmail.com'
ORDER BY au.email;

-- Step 6: Manual test with correct tenant
SELECT 'Manual Tenant Test' as step;

DO $$
DECLARE
  correct_tenant_id UUID;
  school_count_rls_off INTEGER;
  school_count_rls_on INTEGER;
  student_count_rls_off INTEGER;
  student_count_rls_on INTEGER;
BEGIN
  -- Get the tenant where data actually exists
  SELECT tenant_id INTO correct_tenant_id
  FROM public.school_details 
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF correct_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'Found data in tenant: %', correct_tenant_id;
    
    -- Test without RLS
    SET row_security = off;
    SELECT COUNT(*) INTO school_count_rls_off FROM public.school_details WHERE tenant_id = correct_tenant_id;
    SELECT COUNT(*) INTO student_count_rls_off FROM public.students WHERE tenant_id = correct_tenant_id;
    
    RAISE NOTICE 'Direct access (RLS OFF): % school_details, % students', school_count_rls_off, student_count_rls_off;
    
    -- Test with RLS and correct tenant
    SET row_security = on;
    PERFORM set_config('request.jwt.claim.tenant_id', correct_tenant_id::text, true);
    
    SELECT COUNT(*) INTO school_count_rls_on FROM public.school_details;
    SELECT COUNT(*) INTO student_count_rls_on FROM public.students;
    
    RAISE NOTICE 'RLS access with correct tenant: % school_details, % students', school_count_rls_on, student_count_rls_on;
    
    IF school_count_rls_on = 0 AND school_count_rls_off > 0 THEN
      RAISE NOTICE '❌ ISSUE: RLS is blocking access even with correct tenant';
      RAISE NOTICE '🔧 SOLUTION: RLS policies need to be fixed';
    ELSIF school_count_rls_on > 0 THEN
      RAISE NOTICE '✅ RLS works correctly with proper tenant_id';
      RAISE NOTICE '🔧 SOLUTION: Application needs to send correct tenant_id in JWT';
    END IF;
  ELSE
    RAISE NOTICE '❌ No school_details data found in any tenant';
  END IF;
END $$;

-- Step 7: Summary and recommendations
DO $$
DECLARE
  user_tenant UUID;
  auth_tenant TEXT;
  data_tenant UUID;
  session_tenant TEXT;
  visible_schools INTEGER;
BEGIN
  -- Get key information
  SELECT tenant_id INTO user_tenant FROM public.users WHERE email ILIKE '%kenj%' OR email = 'kenj7214@gmail.com' LIMIT 1;
  SELECT raw_user_meta_data->>'tenant_id' INTO auth_tenant FROM auth.users WHERE email ILIKE '%kenj%' OR email = 'kenj7214@gmail.com' LIMIT 1;
  SELECT tenant_id INTO data_tenant FROM public.school_details LIMIT 1;
  session_tenant := current_setting('request.jwt.claim.tenant_id', true);
  SELECT COUNT(*) INTO visible_schools FROM public.school_details;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSIS SUMMARY ===';
  RAISE NOTICE 'User tenant (database): %', user_tenant;
  RAISE NOTICE 'Auth tenant (JWT metadata): %', auth_tenant;
  RAISE NOTICE 'Data tenant (where school_details exist): %', data_tenant;
  RAISE NOTICE 'Current session tenant: %', session_tenant;
  RAISE NOTICE 'Visible school_details: %', visible_schools;
  RAISE NOTICE '';
  
  -- Provide specific recommendations
  IF visible_schools = 0 THEN
    IF session_tenant IS NULL THEN
      RAISE NOTICE '🎯 PRIMARY ISSUE: No tenant_id in current session';
      RAISE NOTICE '📝 SOLUTION: Authentication is not providing tenant_id in JWT token';
    ELSIF session_tenant != data_tenant::text THEN
      RAISE NOTICE '🎯 PRIMARY ISSUE: Session tenant (%) != Data tenant (%)', session_tenant, data_tenant;
      RAISE NOTICE '📝 SOLUTION: JWT token has wrong tenant_id or auth metadata is incorrect';
    ELSE
      RAISE NOTICE '🎯 PRIMARY ISSUE: RLS policies are not working correctly';
      RAISE NOTICE '📝 SOLUTION: Need to fix RLS policy definitions';
    END IF;
  ELSE
    RAISE NOTICE '✅ Data is visible in current session - application issue may be elsewhere';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔧 RECOMMENDED ACTIONS:';
  RAISE NOTICE '1. Run the fix_application_data_access.sql script';
  RAISE NOTICE '2. Log out completely from your application';
  RAISE NOTICE '3. Clear browser cache/cookies';
  RAISE NOTICE '4. Log back in to get fresh JWT token';
END $$;
