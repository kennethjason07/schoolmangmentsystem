-- ==========================================
-- COMPREHENSIVE AUTHENTICATION FIX
-- ==========================================
--
-- This script provides multiple approaches to fix the auth.uid() = null issue
-- Run each section as needed based on the diagnosis results
--
-- ==========================================
-- STEP 1: EMERGENCY RLS BYPASS (TEMPORARY)
-- ==========================================
--
-- If you need immediate access while fixing auth, uncomment these:
-- WARNING: This temporarily disables security - use only for debugging!

/*
-- Temporarily disable RLS on key tables for debugging
ALTER TABLE public.exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.marks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_details DISABLE ROW LEVEL SECURITY;

-- Remember to re-enable RLS later:
-- ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.marks ENABLE ROW LEVEL SECURITY;
-- etc.
*/

-- ==========================================
-- STEP 2: FIX RLS POLICIES FOR NULL AUTH
-- ==========================================
--
-- Update RLS policies to work even when auth.uid() returns null
-- This provides a more robust fallback approach

-- Drop existing problematic policies
DROP POLICY IF EXISTS "tenant_isolation_exams" ON public.exams;
DROP POLICY IF EXISTS "tenant_isolation_marks" ON public.marks;
DROP POLICY IF EXISTS "tenant_isolation_students" ON public.students;
DROP POLICY IF EXISTS "tenant_isolation_classes" ON public.classes;

-- Create improved RLS policies with multiple auth methods
-- These policies try auth.uid() first, then fall back to email-based lookup

-- Exams table policy with robust auth handling
CREATE POLICY "tenant_isolation_exams_robust" ON public.exams
FOR ALL USING (
  -- Method 1: Direct tenant_id from JWT claims
  tenant_id = COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
  )
  OR
  -- Method 2: Lookup via auth.uid() if available
  (auth.uid() IS NOT NULL AND 
   tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  )
  OR
  -- Method 3: Email-based lookup fallback
  (auth.jwt() ->> 'email' IS NOT NULL AND
   tenant_id IN (
     SELECT tenant_id 
     FROM public.users 
     WHERE email = auth.jwt() ->> 'email'
   )
  )
);

-- Marks table policy 
CREATE POLICY "tenant_isolation_marks_robust" ON public.marks
FOR ALL USING (
  -- Method 1: Direct tenant_id from JWT claims
  tenant_id = COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
  )
  OR
  -- Method 2: Lookup via auth.uid() if available
  (auth.uid() IS NOT NULL AND 
   tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  )
  OR
  -- Method 3: Email-based lookup fallback
  (auth.jwt() ->> 'email' IS NOT NULL AND
   tenant_id IN (
     SELECT tenant_id 
     FROM public.users 
     WHERE email = auth.jwt() ->> 'email'
   )
  )
);

-- Students table policy
CREATE POLICY "tenant_isolation_students_robust" ON public.students
FOR ALL USING (
  -- Method 1: Direct tenant_id from JWT claims
  tenant_id = COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
  )
  OR
  -- Method 2: Lookup via auth.uid() if available
  (auth.uid() IS NOT NULL AND 
   tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  )
  OR
  -- Method 3: Email-based lookup fallback
  (auth.jwt() ->> 'email' IS NOT NULL AND
   tenant_id IN (
     SELECT tenant_id 
     FROM public.users 
     WHERE email = auth.jwt() ->> 'email'
   )
  )
);

-- Classes table policy
CREATE POLICY "tenant_isolation_classes_robust" ON public.classes
FOR ALL USING (
  -- Method 1: Direct tenant_id from JWT claims
  tenant_id = COALESCE(
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
  )
  OR
  -- Method 2: Lookup via auth.uid() if available
  (auth.uid() IS NOT NULL AND 
   tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  )
  OR
  -- Method 3: Email-based lookup fallback
  (auth.jwt() ->> 'email' IS NOT NULL AND
   tenant_id IN (
     SELECT tenant_id 
     FROM public.users 
     WHERE email = auth.jwt() ->> 'email'
   )
  )
);

-- ==========================================
-- STEP 3: CREATE SESSION VERIFICATION FUNCTION
-- ==========================================

-- Function to verify if current user session is valid and get tenant info
CREATE OR REPLACE FUNCTION public.verify_current_session()
RETURNS TABLE (
  is_authenticated boolean,
  auth_user_id uuid,
  auth_email text,
  db_user_id uuid,
  db_email text,
  tenant_id uuid,
  diagnosis text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  jwt_email text;
  jwt_user_id uuid;
  user_record record;
BEGIN
  -- Get info from JWT
  jwt_email := auth.jwt() ->> 'email';
  jwt_user_id := auth.uid();
  
  -- Try to find user in database
  IF jwt_user_id IS NOT NULL THEN
    -- Auth.uid() is working, look up by ID
    SELECT u.id, u.email, u.tenant_id
    INTO user_record
    FROM public.users u
    WHERE u.id = jwt_user_id;
    
    RETURN QUERY SELECT 
      true,
      jwt_user_id,
      jwt_email,
      user_record.id,
      user_record.email,
      user_record.tenant_id,
      'SUCCESS: Found user by auth.uid()'::text;
      
  ELSIF jwt_email IS NOT NULL THEN
    -- Fallback to email lookup
    SELECT u.id, u.email, u.tenant_id
    INTO user_record
    FROM public.users u
    WHERE u.email = jwt_email;
    
    IF user_record.id IS NOT NULL THEN
      RETURN QUERY SELECT 
        true,
        jwt_user_id,
        jwt_email,
        user_record.id,
        user_record.email,
        user_record.tenant_id,
        'WARNING: Found user by email (auth.uid is null)'::text;
    ELSE
      RETURN QUERY SELECT 
        false,
        jwt_user_id,
        jwt_email,
        null::uuid,
        null::text,
        null::uuid,
        'ERROR: User email in JWT but not in database'::text;
    END IF;
    
  ELSE
    -- No authentication info available
    RETURN QUERY SELECT 
      false,
      null::uuid,
      null::text,
      null::uuid,
      null::text,
      null::uuid,
      'CRITICAL: No authentication data in JWT'::text;
  END IF;
END;
$$;

-- Grant access to the verification function
GRANT EXECUTE ON FUNCTION public.verify_current_session() TO authenticated, anon;

-- ==========================================
-- STEP 4: UPDATE TENANT HELPER FUNCTIONS
-- ==========================================

-- Update get_current_tenant_id to be more robust
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Method 1: Direct tenant_id from JWT claims
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    -- Method 2: App metadata tenant_id
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    -- Method 3: Database lookup by auth.uid()
    (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1),
    -- Method 4: Database lookup by email from JWT
    (SELECT tenant_id FROM public.users WHERE email = auth.jwt() ->> 'email' LIMIT 1)
  );
$$;

-- Function to get current user with fallbacks
CREATE OR REPLACE FUNCTION public.get_current_user_info()
RETURNS TABLE (
  user_id uuid,
  email text,
  tenant_id uuid,
  role_id integer,
  auth_method text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user_id uuid := auth.uid();
  jwt_email text := auth.jwt() ->> 'email';
  user_rec record;
BEGIN
  -- Try auth.uid() first
  IF auth_user_id IS NOT NULL THEN
    SELECT u.id, u.email, u.tenant_id, u.role_id
    INTO user_rec
    FROM public.users u
    WHERE u.id = auth_user_id;
    
    IF user_rec.id IS NOT NULL THEN
      RETURN QUERY SELECT user_rec.id, user_rec.email, user_rec.tenant_id, user_rec.role_id, 'auth.uid()'::text;
      RETURN;
    END IF;
  END IF;
  
  -- Fallback to email lookup
  IF jwt_email IS NOT NULL THEN
    SELECT u.id, u.email, u.tenant_id, u.role_id
    INTO user_rec
    FROM public.users u
    WHERE u.email = jwt_email;
    
    IF user_rec.id IS NOT NULL THEN
      RETURN QUERY SELECT user_rec.id, user_rec.email, user_rec.tenant_id, user_rec.role_id, 'email_lookup'::text;
      RETURN;
    END IF;
  END IF;
  
  -- No user found
  RETURN QUERY SELECT null::uuid, null::text, null::uuid, null::integer, 'no_user'::text;
END;
$$;

-- Grant access to the user info function
GRANT EXECUTE ON FUNCTION public.get_current_user_info() TO authenticated, anon;

-- ==========================================
-- STEP 5: CREATE APP-LEVEL AUTH BYPASS
-- ==========================================

-- For emergency access, create a function that allows tenant-aware queries
-- without relying on RLS (use this in your app if RLS is still problematic)
CREATE OR REPLACE FUNCTION public.get_tenant_exams(target_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  exam_name text,
  subject_id uuid,
  class_id uuid,
  exam_date date,
  total_marks integer,
  tenant_id uuid,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify current user belongs to the requested tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.verify_current_session() v
    WHERE v.is_authenticated = true 
    AND v.tenant_id = target_tenant_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not belong to tenant %', target_tenant_id;
  END IF;
  
  -- Return exams for the tenant
  RETURN QUERY
  SELECT e.id, e.exam_name, e.subject_id, e.class_id, 
         e.exam_date, e.total_marks, e.tenant_id, e.created_at
  FROM public.exams e
  WHERE e.tenant_id = target_tenant_id;
END;
$$;

-- Grant access to the tenant exams function
GRANT EXECUTE ON FUNCTION public.get_tenant_exams(uuid) TO authenticated;

-- ==========================================
-- STEP 6: TEST THE FIXES
-- ==========================================

-- Test query to verify the fix is working
SELECT 
  'AUTHENTICATION FIX TEST' as test_name,
  is_authenticated,
  auth_user_id,
  auth_email,
  db_user_id,
  db_email,
  tenant_id,
  diagnosis
FROM public.verify_current_session();

-- Test tenant-aware exam access
SELECT 
  'EXAM ACCESS TEST' as test_name,
  COUNT(*) as accessible_exams
FROM public.exams;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
DECLARE
  auth_test record;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '   COMPREHENSIVE AUTHENTICATION FIX APPLIED';
  RAISE NOTICE '==============================================';
  
  -- Test authentication status
  SELECT * INTO auth_test FROM public.verify_current_session() LIMIT 1;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CURRENT AUTHENTICATION STATUS:';
  RAISE NOTICE '   Authenticated: %', COALESCE(auth_test.is_authenticated::text, 'Unknown');
  RAISE NOTICE '   Auth User ID: %', COALESCE(auth_test.auth_user_id::text, 'NULL');
  RAISE NOTICE '   Auth Email: %', COALESCE(auth_test.auth_email, 'NULL');
  RAISE NOTICE '   Database User ID: %', COALESCE(auth_test.db_user_id::text, 'NULL');
  RAISE NOTICE '   Tenant ID: %', COALESCE(auth_test.tenant_id::text, 'NULL');
  RAISE NOTICE '   Diagnosis: %', COALESCE(auth_test.diagnosis, 'No diagnosis available');
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ CHANGES APPLIED:';
  RAISE NOTICE '   1. Robust RLS policies with multiple auth methods';
  RAISE NOTICE '   2. Session verification functions';
  RAISE NOTICE '   3. Enhanced tenant helper functions';
  RAISE NOTICE '   4. Emergency access functions';
  
  RAISE NOTICE '';
  RAISE NOTICE '🎯 NEXT STEPS:';
  RAISE NOTICE '   1. Log out and log back in to your app';
  RAISE NOTICE '   2. Try exam deletion again';
  RAISE NOTICE '   3. Check browser console for any auth errors';
  RAISE NOTICE '   4. If still not working, run the diagnosis script';
  
  IF NOT COALESCE(auth_test.is_authenticated, false) THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  WARNING: No current authentication detected.';
    RAISE NOTICE '   Make sure to log in to your app before testing.';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
END $$;
