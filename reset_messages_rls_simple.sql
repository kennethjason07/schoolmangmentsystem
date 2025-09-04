-- Reset and implement simple, working RLS for messages
-- This removes complex policies and implements basic tenant isolation

-- ==========================================
-- DISABLE RLS TEMPORARILY AND CLEAN UP
-- ==========================================

-- Disable RLS to clear all existing policies
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "messages_tenant_isolation" ON public.messages;
DROP POLICY IF EXISTS "messages_chat_access" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_update_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_policy" ON public.messages;
DROP POLICY IF EXISTS "messages_admin_access" ON public.messages;

-- Drop trigger
DROP TRIGGER IF EXISTS enforce_tenant_id_messages ON public.messages;

-- ==========================================
-- CREATE SIMPLE, WORKING RLS POLICIES
-- ==========================================

-- Re-enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Simple policy: Users can access messages where they are sender or receiver
-- AND within their tenant (using database lookup, not JWT)
CREATE POLICY "messages_user_access" ON public.messages
  FOR ALL USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid()) AND
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- ==========================================
-- CREATE SIMPLE TENANT ENFORCEMENT TRIGGER
-- ==========================================

-- Simple trigger function that sets tenant_id from user table
CREATE OR REPLACE FUNCTION public.set_message_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set tenant_id from current user's tenant_id if not already set
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id 
    FROM public.users 
    WHERE id = auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for automatic tenant_id setting
CREATE TRIGGER set_message_tenant_id_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_tenant_id();

-- ==========================================
-- VERIFY THE SETUP
-- ==========================================

-- Show the policy
SELECT schemaname, tablename, policyname, permissive, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'messages';

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  relrowsecurity as rls_enabled
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public' AND tablename = 'messages';

-- ==========================================
-- TEST MESSAGE ACCESS
-- ==========================================

-- Count all messages in the table (as superuser/admin)
-- This should show the total count regardless of RLS
SELECT COUNT(*) as total_messages FROM public.messages;

-- Show sample messages (first 5)
SELECT 
  id,
  sender_id, 
  receiver_id, 
  message,
  tenant_id,
  sent_at
FROM public.messages 
ORDER BY sent_at DESC 
LIMIT 5;
