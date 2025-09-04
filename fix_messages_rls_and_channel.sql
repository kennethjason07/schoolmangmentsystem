-- Fix RLS policies for messages table to properly handle chat functionality
-- This addresses tenant isolation and message access permissions

-- ==========================================
-- DROP EXISTING POLICIES (if any)
-- ==========================================

-- Drop existing message policies to start fresh
DROP POLICY IF EXISTS "messages_tenant_isolation" ON public.messages;
DROP POLICY IF EXISTS "messages_chat_access" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;

-- ==========================================
-- CREATE COMPREHENSIVE MESSAGES RLS POLICIES
-- ==========================================

-- Enable RLS on messages table (in case not already enabled)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy: Users can view messages they sent or received within their tenant
CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

-- 2. INSERT Policy: Users can insert messages within their tenant
CREATE POLICY "messages_insert_policy" ON public.messages
  FOR INSERT WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    sender_id = auth.uid()
  );

-- 3. UPDATE Policy: Users can update their own sent messages within their tenant
CREATE POLICY "messages_update_policy" ON public.messages
  FOR UPDATE USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    sender_id = auth.uid()
  ) WITH CHECK (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    sender_id = auth.uid()
  );

-- 4. DELETE Policy: Users can delete their own sent messages within their tenant
CREATE POLICY "messages_delete_policy" ON public.messages
  FOR DELETE USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    sender_id = auth.uid()
  );

-- ==========================================
-- CREATE TRIGGER FOR AUTOMATIC TENANT_ID ENFORCEMENT
-- ==========================================

-- Create or replace trigger for messages table
DROP TRIGGER IF EXISTS enforce_tenant_id_messages ON public.messages;

CREATE TRIGGER enforce_tenant_id_messages
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- ==========================================
-- ADDITIONAL POLICIES FOR ADMIN ACCESS
-- ==========================================

-- Allow admins to view all messages within their tenant
CREATE POLICY "messages_admin_access" ON public.messages
  FOR ALL USING (
    tenant_id::text = auth.jwt() ->> 'tenant_id' AND
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
        AND u.tenant_id::text = auth.jwt() ->> 'tenant_id'
        AND r.role_name IN ('admin', 'super_admin')
    )
  );

-- ==========================================
-- VALIDATE POLICIES ARE WORKING
-- ==========================================

-- Show all policies on messages table for verification
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY policyname;

-- ==========================================
-- HELPER FUNCTIONS FOR DEBUGGING
-- ==========================================

-- Function to debug RLS context for messages
CREATE OR REPLACE FUNCTION public.debug_messages_rls_context()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'user_id', auth.uid(),
    'jwt_tenant_id', auth.jwt() ->> 'tenant_id',
    'jwt_role', auth.jwt() ->> 'role',
    'user_tenant_id', (SELECT tenant_id::text FROM public.users WHERE id = auth.uid()),
    'user_role', (SELECT r.role_name FROM public.users u JOIN public.roles r ON u.role_id = r.id WHERE u.id = auth.uid()),
    'policies_enabled', (SELECT ROW_SECURITY FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages')
  );
$$;

COMMENT ON FUNCTION public.debug_messages_rls_context() IS 'Debug function to check RLS context for messages table';
