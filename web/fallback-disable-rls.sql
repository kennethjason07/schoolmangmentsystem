-- ============================================
-- FALLBACK APPROACH: Temporarily disable RLS for testing
-- WARNING: Only use this for development/testing!
-- ============================================

-- Temporarily disable RLS on these tables for tenant creation
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE school_details DISABLE ROW LEVEL SECURITY;

-- After you're done testing, REMEMBER to re-enable RLS:
-- ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE school_details ENABLE ROW LEVEL SECURITY;
