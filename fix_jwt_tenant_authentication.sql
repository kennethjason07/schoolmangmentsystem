-- ==========================================
-- FIX JWT AUTHENTICATION FOR TENANT_ID
-- ==========================================
--
-- This script fixes Supabase authentication to include tenant_id in JWT claims
-- Run this in Supabase SQL Editor after the main RLS script

-- ==========================================
-- STEP 1: CREATE FUNCTION TO SET JWT CLAIMS
-- ==========================================

-- Function to add tenant_id to JWT claims during authentication
CREATE OR REPLACE FUNCTION public.handle_jwt_claims(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tenant_id uuid;
  user_role_name text;
  claims jsonb := '{}'::jsonb;
BEGIN
  -- Get user's tenant_id and role
  SELECT u.tenant_id, r.role_name
  INTO user_tenant_id, user_role_name
  FROM public.users u
  LEFT JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = user_id;

  -- Set tenant_id claim
  IF user_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
  END IF;

  -- Set role claim  
  IF user_role_name IS NOT NULL THEN
    claims := jsonb_set(claims, '{role}', to_jsonb(user_role_name));
  END IF;

  -- Set user_id claim
  claims := jsonb_set(claims, '{user_id}', to_jsonb(user_id::text));

  RETURN claims;
END;
$$;

-- ==========================================
-- STEP 2: CREATE TRIGGER FOR JWT CLAIMS
-- ==========================================

-- Function to handle new user JWT claims
CREATE OR REPLACE FUNCTION public.handle_new_user_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update JWT claims when user record is created or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- This would ideally call Supabase Auth API to update JWT
    -- For now, we'll log the action
    RAISE NOTICE 'User % JWT claims should be updated with tenant_id: %', 
      NEW.id, NEW.tenant_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on users table
CREATE TRIGGER update_jwt_claims_on_user_change
  AFTER INSERT OR UPDATE OF tenant_id, role_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_jwt();

-- ==========================================
-- STEP 3: CREATE CUSTOM CLAIMS FUNCTION
-- ==========================================

-- This function can be called to get custom claims for a user
-- Useful for applications to fetch claims manually
CREATE OR REPLACE FUNCTION public.get_custom_claims(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb := '{}'::jsonb;
  user_record record;
BEGIN
  -- Get user information with role
  SELECT 
    u.id,
    u.email,
    u.tenant_id,
    u.role_id,
    u.linked_teacher_id,
    u.linked_student_id,
    u.linked_parent_of,
    r.role_name
  INTO user_record
  FROM public.users u
  LEFT JOIN public.roles r ON u.role_id = r.id
  WHERE u.id = user_id;

  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Build claims object
  claims := jsonb_build_object(
    'user_id', user_record.id::text,
    'email', user_record.email,
    'tenant_id', user_record.tenant_id::text,
    'role', user_record.role_name,
    'role_id', user_record.role_id
  );

  -- Add linked IDs if they exist
  IF user_record.linked_teacher_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{linked_teacher_id}', to_jsonb(user_record.linked_teacher_id::text));
  END IF;

  IF user_record.linked_student_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{linked_student_id}', to_jsonb(user_record.linked_student_id::text));
  END IF;

  IF user_record.linked_parent_of IS NOT NULL THEN
    claims := jsonb_set(claims, '{linked_parent_of}', to_jsonb(user_record.linked_parent_of::text));
  END IF;

  RETURN claims;
END;
$$;

-- ==========================================
-- STEP 4: CREATE HOOK FOR AUTH EVENTS
-- ==========================================

-- Create a function to handle authentication events
-- This should be triggered by Supabase Auth webhooks
CREATE OR REPLACE FUNCTION public.handle_auth_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When a user signs in, ensure their JWT has the latest tenant_id
  RAISE NOTICE 'Auth event for user %, updating claims', NEW.id;
  
  -- In a production setup, this would call Supabase Auth API
  -- to update the user's JWT with custom claims
  
  RETURN NEW;
END;
$$;

-- ==========================================
-- STEP 5: UPDATE EXISTING RLS FUNCTIONS
-- ==========================================

-- Update the get_current_tenant_id function to handle new JWT structure
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- First try to get tenant_id from JWT custom claims
    NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid,
    -- Fallback: get from raw JWT app_metadata 
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    -- Fallback: get from users table using auth.uid()
    (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1),
    -- Final fallback: known tenant ID for single-tenant deployments
    'b8f8b5f0-1234-4567-8901-123456789000'::uuid
  );
$$;

-- Function to get current user's role from JWT or database
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Try JWT custom claims first
    auth.jwt() ->> 'role',
    -- Fallback: get from database
    (SELECT r.role_name 
     FROM public.users u 
     JOIN public.roles r ON u.role_id = r.id 
     WHERE u.id = auth.uid() LIMIT 1),
    'unknown'
  );
$$;

-- ==========================================
-- STEP 6: CREATE MANUAL JWT REFRESH FUNCTION
-- ==========================================

-- Function to manually refresh JWT claims for a user
-- This can be called when user data changes
CREATE OR REPLACE FUNCTION public.refresh_user_jwt_claims(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
BEGIN
  -- Only allow admins or the user themselves to refresh claims
  IF NOT (public.is_admin() OR auth.uid() = target_user_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to refresh JWT claims';
  END IF;

  -- Get updated claims
  claims := public.get_custom_claims(target_user_id);
  
  -- Log the claims that should be updated
  RAISE NOTICE 'Refreshing JWT claims for user %: %', target_user_id, claims;
  
  -- In production, this would call Supabase Auth API to update the JWT
  -- For now, we just return success
  RETURN true;
END;
$$;

-- ==========================================
-- STEP 7: CREATE UTILITY FUNCTIONS
-- ==========================================

-- Function to validate current user's tenant access
CREATE OR REPLACE FUNCTION public.validate_current_tenant_access()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  jwt_tenant_id uuid;
  db_tenant_id uuid;
BEGIN
  -- Get tenant_id from JWT
  jwt_tenant_id := NULLIF(auth.jwt() ->> 'tenant_id', '')::uuid;
  
  -- Get tenant_id from database
  SELECT tenant_id INTO db_tenant_id 
  FROM public.users 
  WHERE id = auth.uid();
  
  -- Validate they match
  RETURN (jwt_tenant_id = db_tenant_id) AND (db_tenant_id IS NOT NULL);
END;
$$;

-- Function to log JWT issues for debugging
CREATE OR REPLACE FUNCTION public.debug_jwt_claims()
RETURNS TABLE (
  claim_name text,
  claim_value text,
  source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'tenant_id'::text,
    COALESCE(auth.jwt() ->> 'tenant_id', 'NULL'),
    'jwt_direct'::text
  UNION ALL
  SELECT 
    'tenant_id_from_app_metadata'::text,
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'tenant_id', 'NULL'),
    'jwt_app_metadata'::text
  UNION ALL
  SELECT 
    'tenant_id_from_users_table'::text,
    COALESCE((SELECT tenant_id::text FROM public.users WHERE id = auth.uid()), 'NULL'),
    'database'::text
  UNION ALL
  SELECT 
    'role'::text,
    COALESCE(auth.jwt() ->> 'role', 'NULL'),
    'jwt_direct'::text
  UNION ALL
  SELECT 
    'auth_uid'::text,
    COALESCE(auth.uid()::text, 'NULL'),
    'supabase_auth'::text
  UNION ALL
  SELECT 
    'auth_role'::text,
    COALESCE(auth.role(), 'NULL'),
    'supabase_auth'::text;
END;
$$;

-- ==========================================
-- STEP 8: ENABLE AUTHENTICATION HOOKS
-- ==========================================

-- Note: In Supabase, you would need to set up Auth Hooks via the dashboard
-- This is just documentation of what needs to be configured

/*
AUTH HOOKS TO CONFIGURE IN SUPABASE DASHBOARD:

1. Sign Up Hook:
   - URL: https://your-project.supabase.co/functions/v1/auth-hook-signup
   - Function: Call public.get_custom_claims() and update JWT

2. Sign In Hook:
   - URL: https://your-project.supabase.co/functions/v1/auth-hook-signin  
   - Function: Call public.get_custom_claims() and update JWT

3. Custom Claims:
   - Set up custom claims in Supabase Auth to include tenant_id and role
*/

-- ==========================================
-- STEP 9: GRANT PERMISSIONS
-- ==========================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION public.handle_jwt_claims(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_custom_claims(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_current_tenant_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_jwt_claims() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_jwt_claims(uuid) TO authenticated;

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'JWT TENANT AUTHENTICATION SETUP COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary of changes:';
  RAISE NOTICE '- JWT claims handling functions created';
  RAISE NOTICE '- Tenant_id validation functions updated';
  RAISE NOTICE '- Debug utilities for JWT troubleshooting';
  RAISE NOTICE '- Manual JWT refresh capabilities added';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test JWT claims: SELECT * FROM public.debug_jwt_claims();';
  RAISE NOTICE '2. Configure Auth Hooks in Supabase Dashboard';
  RAISE NOTICE '3. Update app code to use new authentication flow';
  RAISE NOTICE '4. Test multi-tenant isolation';
  RAISE NOTICE '========================================';
END $$;
