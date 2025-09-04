-- Fix the INSERT policy for messages table with proper WITH CHECK clause
-- This needs to be run in Supabase SQL Editor or another PostgreSQL client

-- Drop and recreate the INSERT policy with proper WITH CHECK
DROP POLICY IF EXISTS "messages_insert_policy" ON public.messages;

CREATE POLICY "messages_insert_policy" ON public.messages
  FOR INSERT WITH CHECK (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', (SELECT tenant_id::text FROM public.users WHERE id = auth.uid())) AND
    sender_id = auth.uid()
  );

-- Also update SELECT policy to be more robust
DROP POLICY IF EXISTS "messages_select_policy" ON public.messages;

CREATE POLICY "messages_select_policy" ON public.messages
  FOR SELECT USING (
    tenant_id::text = COALESCE(auth.jwt() ->> 'tenant_id', (SELECT tenant_id::text FROM public.users WHERE id = auth.uid())) AND
    (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'messages' 
ORDER BY policyname;
