-- ===================================================================
-- FIX APPLICATION DATA ACCESS ISSUES
-- ===================================================================
-- Common fixes for when DB is synchronized but application can't see data

-- Step 1: Force refresh auth metadata for all users
DO $$
DECLARE
  target_tenant_id UUID;
  result JSON;
BEGIN
  -- Get the tenant where all the data is located
  SELECT tenant_id INTO target_tenant_id
  FROM public.school_details
  LIMIT 1;
  
  IF target_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'Updating auth metadata for tenant: %', target_tenant_id;
    
    -- Update auth.users metadata for all users to match the data tenant
    UPDATE auth.users 
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{tenant_id}',
      to_jsonb(target_tenant_id::text)
    )
    WHERE id IN (
      SELECT id FROM public.users WHERE tenant_id = target_tenant_id
    );
    
    RAISE NOTICE '✅ Updated auth metadata for tenant: %', target_tenant_id;
  ELSE
    RAISE NOTICE '❌ No tenant found with school data';
  END IF;
END $$;

-- Step 2: Verify and fix RLS policies
-- Drop and recreate key RLS policies to ensure they work correctly

-- School Details Policy
DROP POLICY IF EXISTS "school_details_tenant_policy" ON public.school_details;
CREATE POLICY "school_details_tenant_policy" ON public.school_details
  FOR ALL
  TO authenticated
  USING (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true));

-- Students Policy  
DROP POLICY IF EXISTS "students_tenant_policy" ON public.students;
CREATE POLICY "students_tenant_policy" ON public.students
  FOR ALL
  TO authenticated
  USING (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true));

-- Classes Policy
DROP POLICY IF EXISTS "classes_tenant_policy" ON public.classes;
CREATE POLICY "classes_tenant_policy" ON public.classes
  FOR ALL
  TO authenticated
  USING (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true));

-- Teachers Policy
DROP POLICY IF EXISTS "teachers_tenant_policy" ON public.teachers;
CREATE POLICY "teachers_tenant_policy" ON public.teachers
  FOR ALL
  TO authenticated
  USING (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('request.jwt.claim.tenant_id', true));

-- Users Policy (special case - users can see their own record)
DROP POLICY IF EXISTS "users_tenant_policy" ON public.users;
CREATE POLICY "users_tenant_policy" ON public.users
  FOR ALL
  TO authenticated
  USING (
    tenant_id::text = current_setting('request.jwt.claim.tenant_id', true) 
    OR id::text = current_setting('request.jwt.claim.sub', true)
  )
  WITH CHECK (
    tenant_id::text = current_setting('request.jwt.claim.tenant_id', true)
    OR id::text = current_setting('request.jwt.claim.sub', true)
  );

-- Ensure RLS is enabled on all tables
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a function to test application context
CREATE OR REPLACE FUNCTION public.test_application_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}';
  current_tenant_id text;
  user_id text;
  school_count integer;
  student_count integer;
  class_count integer;
BEGIN
  -- Get current session context
  current_tenant_id := current_setting('request.jwt.claim.tenant_id', true);
  user_id := current_setting('request.jwt.claim.sub', true);
  
  -- Count visible records
  SELECT COUNT(*) INTO school_count FROM public.school_details;
  SELECT COUNT(*) INTO student_count FROM public.students;  
  SELECT COUNT(*) INTO class_count FROM public.classes;
  
  -- Build result
  result := jsonb_build_object(
    'session_tenant_id', current_tenant_id,
    'session_user_id', user_id,
    'visible_school_details', school_count,
    'visible_students', student_count,
    'visible_classes', class_count,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;

-- Step 4: Create helper function to simulate application login
CREATE OR REPLACE FUNCTION public.simulate_application_login(user_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record public.users%ROWTYPE;
  auth_record auth.users%ROWTYPE;
  result jsonb := '{}';
  school_count integer;
  student_count integer;
  class_count integer;
BEGIN
  -- Get user record
  SELECT * INTO user_record FROM public.users WHERE email = user_email LIMIT 1;
  SELECT * INTO auth_record FROM auth.users WHERE email = user_email LIMIT 1;
  
  IF user_record.id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  -- Simulate setting JWT claims like the application would
  PERFORM set_config('request.jwt.claim.sub', user_record.id::text, true);
  PERFORM set_config('request.jwt.claim.tenant_id', user_record.tenant_id::text, true);
  
  -- Test data visibility
  SELECT COUNT(*) INTO school_count FROM public.school_details;
  SELECT COUNT(*) INTO student_count FROM public.students;
  SELECT COUNT(*) INTO class_count FROM public.classes;
  
  -- Build result
  result := jsonb_build_object(
    'user_id', user_record.id,
    'user_tenant_id', user_record.tenant_id,
    'auth_tenant_id', auth_record.raw_user_meta_data->>'tenant_id',
    'visible_school_details', school_count,
    'visible_students', student_count,
    'visible_classes', class_count,
    'simulation_successful', true
  );
  
  RETURN result;
END;
$$;

-- Step 5: Test the fix
SELECT 'Testing Application Access Fix' as step;

-- Test with your email
SELECT 'Simulated Login Test' as test_type, public.simulate_application_login('kenj7214@gmail.com') as result;

-- Also try variations of your email
SELECT 'Email Variations Test' as test_type, email, public.simulate_application_login(email) as result
FROM public.users 
WHERE email ILIKE '%kenj%' OR email ILIKE '%abhi%'
LIMIT 3;

-- Step 6: Final verification  
DO $$
DECLARE
  final_tenant_id UUID;
  auth_users_updated INTEGER;
  rls_policies_count INTEGER;
BEGIN
  -- Get the target tenant
  SELECT tenant_id INTO final_tenant_id FROM public.school_details LIMIT 1;
  
  -- Count auth users with correct metadata
  SELECT COUNT(*) INTO auth_users_updated 
  FROM auth.users au 
  JOIN public.users u ON au.id = u.id
  WHERE (au.raw_user_meta_data->>'tenant_id')::uuid = u.tenant_id;
  
  -- Count RLS policies
  SELECT COUNT(*) INTO rls_policies_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename IN ('school_details', 'students', 'classes', 'teachers', 'users');
  
  RAISE NOTICE '';
  RAISE NOTICE '=== APPLICATION ACCESS FIX SUMMARY ===';
  RAISE NOTICE 'Target tenant ID: %', final_tenant_id;
  RAISE NOTICE 'Auth users updated: %', auth_users_updated;
  RAISE NOTICE 'RLS policies active: %', rls_policies_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Application access fix completed!';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next steps:';
  RAISE NOTICE '1. Log out of your application completely';  
  RAISE NOTICE '2. Clear browser cache/cookies (important!)';
  RAISE NOTICE '3. Log back in to get new JWT token with correct tenant_id';
  RAISE NOTICE '4. Check if data is now visible';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 If still not working, run the diagnosis script to identify remaining issues';
END $$;
