-- fix_rls_users_roles_tenants.sql
-- Purpose: Ensure RLS is enabled and create safe, tenant-aware read policies for users, roles, and tenants tables
-- Usage: Run in Supabase SQL editor (or psql) against your project's database.
-- Notes:
-- - Policies are created only if they do not already exist (checked via pg_policies).
-- - The users policy restricts reads to the same tenant as in the caller's JWT claims.
-- - The tenants policy restricts reads to the caller's tenant.
-- - The roles policy is readable by both anon and authenticated (assuming it’s global and safe to expose).
-- - Adjust table schema names if your tables are in a schema other than public.

-- Enable RLS on target tables (idempotent; no-op if already enabled)
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;

-- Helper: expression to read tenant_id from JWT claims
-- current_setting('request.jwt.claims', true) returns text or NULL; cast to jsonb then ->> 'tenant_id'
-- coalesce(..., '') ensures we compare to empty string when missing

-- USERS: allow authenticated users to SELECT rows for their tenant only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'users_select_same_tenant'
      AND schemaname = 'public'
      AND tablename = 'users'
  ) THEN
    EXECUTE $$
      CREATE POLICY users_select_same_tenant
      ON public.users
      FOR SELECT
      TO authenticated
      USING (
        tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', '')
      )
    $$;
  END IF;
END$$;

-- ROLES: allow anon and authenticated to SELECT (global lookup)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'roles_select_all_public'
      AND schemaname = 'public'
      AND tablename = 'roles'
  ) THEN
    EXECUTE $$
      CREATE POLICY roles_select_all_public
      ON public.roles
      FOR SELECT
      TO anon, authenticated
      USING (true)
    $$;
  END IF;
END$$;

-- TENANTS: allow authenticated users to SELECT only their tenant row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE polname = 'tenants_select_own_tenant'
      AND schemaname = 'public'
      AND tablename = 'tenants'
  ) THEN
    EXECUTE $$
      CREATE POLICY tenants_select_own_tenant
      ON public.tenants
      FOR SELECT
      TO authenticated
      USING (
        id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', '')
      )
    $$;
  END IF;
END$$;

-- Optional: verify effective visibility for the current session (uncomment to test in SQL editor)
-- SELECT 'users_visible' AS table_name, count(*) AS rows
--   FROM public.users
--   WHERE tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', '')
-- UNION ALL
-- SELECT 'roles_visible', count(*) FROM public.roles
-- UNION ALL
-- SELECT 'tenants_visible', count(*) FROM public.tenants WHERE id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', '');

