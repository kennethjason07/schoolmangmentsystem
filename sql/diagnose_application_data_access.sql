-- ===================================================================
-- DIAGNOSE APPLICATION DATA ACCESS ISSUES
-- ===================================================================
-- Check why the application can't see data even though DB is synchronized

-- Step 1: Verify current user authentication context
SELECT 'Authentication Context Check' as step;

-- Check what the current session sees
SELECT 
  'current_session_info' as info_type,
  current_user as database_user,
  current_setting('request.jwt.claims', true)::json as jwt_claims,
  current_setting('request.jwt.claim.sub', true) as user_id,
  current_setting('request.jwt.claim.tenant_id', true) as session_tenant_id;

-- Step 2: Check user's tenant assignment vs session
SELECT 'User Tenant Assignment Check' as step;

-- Show user's actual tenant vs what session thinks
SELECT 
  'user_vs_session_tenant' as check_type,
  u.email,
  u.tenant_id as user_database_tenant_id,
  current_setting('request.jwt.claim.tenant_id', true) as session_tenant_id,
  CASE 
    WHEN u.tenant_id::text = current_setting('request.jwt.claim.tenant_id', true) 
    THEN '✅ MATCH - Tenant IDs align'
    ELSE '❌ MISMATCH - Session: ' || COALESCE(current_setting('request.jwt.claim.tenant_id', true), 'NULL') || ', Database: ' || u.tenant_id::text
  END as tenant_alignment_status,
  'User DB Tenant: ' || u.tenant_id::text as explicit_user_tenant,
  'Session Tenant: ' || COALESCE(current_setting('request.jwt.claim.tenant_id', true), 'NULL') as explicit_session_tenant
FROM public.users u
WHERE u.email = 'kenj7214@gmail.com' 
   OR u.email ILIKE '%kenj%' 
   OR u.email ILIKE '%abhi%'
ORDER BY u.email;

-- Step 3: Test RLS policies by checking what data is visible
SELECT 'RLS Policy Test' as step;

-- Test school_details visibility
SELECT 
  'school_details_visibility' as table_name,
  COUNT(*) as records_visible,
  string_agg(DISTINCT tenant_id::text, ', ') as tenant_ids_visible,
  string_agg(DISTINCT name, ', ') as school_names_visible
FROM public.school_details;

-- Test students visibility  
SELECT 
  'students_visibility' as table_name,
  COUNT(*) as records_visible,
  string_agg(DISTINCT tenant_id::text, ', ') as tenant_ids_visible,
  string_agg(DISTINCT full_name, ', ') as sample_student_names
FROM public.students;

-- Test classes visibility
SELECT 
  'classes_visibility' as table_name,
  COUNT(*) as records_visible,
  string_agg(DISTINCT tenant_id::text, ', ') as tenant_ids_visible,
  string_agg(DISTINCT class_name, ', ') as class_names_visible
FROM public.classes;

-- Test teachers visibility
SELECT 
  'teachers_visibility' as table_name,
  COUNT(*) as records_visible,
  string_agg(DISTINCT tenant_id::text, ', ') as tenant_ids_visible,
  string_agg(DISTINCT full_name, ', ') as sample_teacher_names
FROM public.teachers;

-- Step 4: Check RLS policy definitions
SELECT 'RLS Policy Analysis' as step;

-- Check if RLS is enabled on key tables
SELECT 
  'rls_status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('school_details', 'students', 'classes', 'teachers', 'users')
ORDER BY tablename;

-- Show actual RLS policies
SELECT 
  'rls_policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('school_details', 'students', 'classes', 'teachers', 'users')
ORDER BY tablename, policyname;

-- Step 5: Manual tenant context test
SELECT 'Manual Tenant Context Test' as step;

-- Try to manually set tenant context and test
DO $$
DECLARE
  test_tenant_id UUID;
  school_count INTEGER;
  student_count INTEGER;
  class_count INTEGER;
BEGIN
  -- Get the tenant where data actually exists
  SELECT tenant_id INTO test_tenant_id
  FROM public.school_details
  LIMIT 1;
  
  IF test_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'Testing with tenant_id: %', test_tenant_id;
    
    -- Test direct access bypassing RLS temporarily
    SET row_security = off;
    
    SELECT COUNT(*) INTO school_count FROM public.school_details WHERE tenant_id = test_tenant_id;
    SELECT COUNT(*) INTO student_count FROM public.students WHERE tenant_id = test_tenant_id;
    SELECT COUNT(*) INTO class_count FROM public.classes WHERE tenant_id = test_tenant_id;
    
    RAISE NOTICE 'Direct access results (RLS OFF):';
    RAISE NOTICE '  School details: % records', school_count;
    RAISE NOTICE '  Students: % records', student_count;
    RAISE NOTICE '  Classes: % records', class_count;
    
    -- Re-enable RLS
    SET row_security = on;
    
    -- Try with RLS but manual tenant setting
    PERFORM set_config('request.jwt.claim.tenant_id', test_tenant_id::text, true);
    
    SELECT COUNT(*) INTO school_count FROM public.school_details;
    SELECT COUNT(*) INTO student_count FROM public.students;
    SELECT COUNT(*) INTO class_count FROM public.classes;
    
    RAISE NOTICE 'RLS access with manual tenant setting:';
    RAISE NOTICE '  School details: % records', school_count;
    RAISE NOTICE '  Students: % records', student_count;
    RAISE NOTICE '  Classes: % records', class_count;
    
  ELSE
    RAISE NOTICE '❌ No tenant found with school data';
  END IF;
END $$;

-- Step 6: Check auth.users metadata
SELECT 'Auth Users Metadata Check' as step;

-- Check if auth.users has correct tenant_id in raw_user_meta_data
SELECT 
  'auth_users_metadata' as check_type,
  au.email,
  au.raw_user_meta_data->>'tenant_id' as auth_tenant_id,
  u.tenant_id as users_table_tenant_id,
  CASE 
    WHEN (au.raw_user_meta_data->>'tenant_id')::uuid = u.tenant_id 
    THEN '✅ MATCH - Auth metadata aligns with users table'
    ELSE '❌ MISMATCH - Auth: ' || COALESCE(au.raw_user_meta_data->>'tenant_id', 'NULL') || ', Users: ' || u.tenant_id::text
  END as metadata_alignment_status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email = 'kenj7214@gmail.com' 
   OR au.email ILIKE '%kenj%' 
   OR au.email ILIKE '%abhi%'
ORDER BY au.email;

-- Step 7: Final diagnosis summary
DO $$
DECLARE
  user_tenant UUID;
  auth_tenant TEXT;
  school_exists BOOLEAN;
  student_exists BOOLEAN;
  rls_enabled BOOLEAN;
BEGIN
  -- Get user's actual tenant
  SELECT tenant_id INTO user_tenant FROM public.users WHERE email = 'kenj7214@gmail.com' OR email ILIKE '%kenj%' LIMIT 1;
  
  -- Get auth tenant
  SELECT raw_user_meta_data->>'tenant_id' INTO auth_tenant FROM auth.users WHERE email = 'kenj7214@gmail.com' OR email ILIKE '%kenj%' LIMIT 1;
  
  -- Check if data exists in that tenant
  SELECT EXISTS(SELECT 1 FROM public.school_details WHERE tenant_id = user_tenant) INTO school_exists;
  SELECT EXISTS(SELECT 1 FROM public.students WHERE tenant_id = user_tenant) INTO student_exists;
  
  -- Check RLS status
  SELECT rowsecurity INTO rls_enabled FROM pg_tables WHERE tablename = 'school_details' AND schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '=== DIAGNOSIS SUMMARY ===';
  RAISE NOTICE 'User tenant (database): %', user_tenant;
  RAISE NOTICE 'Auth tenant (metadata): %', auth_tenant;
  RAISE NOTICE 'School data exists: %', CASE WHEN school_exists THEN 'Yes' ELSE 'No' END;
  RAISE NOTICE 'Student data exists: %', CASE WHEN student_exists THEN 'Yes' ELSE 'No' END;
  RAISE NOTICE 'RLS enabled: %', CASE WHEN rls_enabled THEN 'Yes' ELSE 'No' END;
  RAISE NOTICE '';
  
  IF user_tenant IS NOT NULL AND auth_tenant IS NOT NULL AND user_tenant::text = auth_tenant THEN
    IF school_exists AND student_exists THEN
      IF rls_enabled THEN
        RAISE NOTICE '🔍 LIKELY ISSUE: RLS policies may not be working correctly';
        RAISE NOTICE '📝 RECOMMENDED ACTIONS:';
        RAISE NOTICE '1. Check RLS policy definitions above';
        RAISE NOTICE '2. Verify JWT token contains correct tenant_id';  
        RAISE NOTICE '3. Test application authentication flow';
      ELSE
        RAISE NOTICE '⚠️  RLS is disabled - data should be visible';
      END IF;
    ELSE
      RAISE NOTICE '❌ ISSUE: Data missing in tenant %', user_tenant;
    END IF;
  ELSE
    RAISE NOTICE '❌ ISSUE: Tenant mismatch between user table and auth metadata';
    RAISE NOTICE '🔧 Run update_user_tenant_metadata() function to fix';
  END IF;
END $$;
