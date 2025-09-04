-- Debug script for messages RLS functionality
-- Run this in Supabase SQL Editor to test and debug RLS

-- ==========================================
-- CREATE DEBUG FUNCTION (if not exists)
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
    'rls_enabled', (
      SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = 'messages' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    )
  );
$$;

-- ==========================================
-- TEST MESSAGE INSERT DIRECTLY
-- ==========================================

-- Test inserting a message to see what happens
-- Replace these UUIDs with actual values from your system
/*
INSERT INTO public.messages (
  sender_id, 
  receiver_id, 
  message, 
  message_type, 
  tenant_id,
  student_id,
  sent_at
) VALUES (
  '29f2503f-e583-4cc3-b4fa-dab13bbc4b4b', -- Your student user ID
  'c2086806-26f5-4159-8863-ac2dfc03e9c0', -- Teacher user ID  
  'Test message from SQL',
  'text',
  (SELECT tenant_id FROM public.users WHERE id = '29f2503f-e583-4cc3-b4fa-dab13bbc4b4b'), -- Get tenant from student user
  (SELECT linked_student_id FROM public.users WHERE id = '29f2503f-e583-4cc3-b4fa-dab13bbc4b4b'), -- Get student ID
  NOW()
);
*/

-- ==========================================
-- CHECK EXISTING MESSAGES
-- ==========================================

-- Check what messages already exist
SELECT 
  id,
  sender_id,
  receiver_id,
  message,
  tenant_id,
  student_id,
  sent_at
FROM public.messages 
ORDER BY sent_at DESC 
LIMIT 10;

-- ==========================================
-- CHECK USER DATA
-- ==========================================

-- Check the users table for tenant information
SELECT 
  id,
  email,
  full_name,
  tenant_id,
  linked_student_id,
  linked_teacher_id
FROM public.users 
WHERE id IN (
  '29f2503f-e583-4cc3-b4fa-dab13bbc4b4b',  -- Student user ID
  'c2086806-26f5-4159-8863-ac2dfc03e9c0'   -- Teacher user ID
);

-- ==========================================
-- VERIFY POLICIES
-- ==========================================

-- Show current policies on messages table
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd, 
  LENGTH(qual) as qual_length,
  LENGTH(with_check) as with_check_length
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'messages'
ORDER BY policyname;
