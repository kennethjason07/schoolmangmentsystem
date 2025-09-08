-- Simple fix for UPI settings RLS policies
-- Copy and paste this into the Supabase SQL Editor to fix the RLS issue

-- Drop the restrictive policies that require specific role names
DROP POLICY IF EXISTS "Admin can insert school UPI settings for their tenant" ON public.school_upi_settings;
DROP POLICY IF EXISTS "Admin can update school UPI settings for their tenant" ON public.school_upi_settings;  
DROP POLICY IF EXISTS "Admin can delete school UPI settings for their tenant" ON public.school_upi_settings;

-- Create simpler, more permissive policies that just check tenant_id
-- These will allow any authenticated user to manage UPI settings for their own tenant

CREATE POLICY "Authenticated users can insert UPI settings for their tenant"
  ON public.school_upi_settings
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
  );

CREATE POLICY "Authenticated users can update UPI settings for their tenant"
  ON public.school_upi_settings
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
  );

CREATE POLICY "Authenticated users can delete UPI settings for their tenant"
  ON public.school_upi_settings
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_upi_settings TO authenticated;

-- The SELECT policy should already exist and be working, but let's make sure
CREATE POLICY "Authenticated users can view UPI settings for their tenant"
  ON public.school_upi_settings
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
  );
