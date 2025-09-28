-- Debug script for facial recognition RLS issues
-- Run this in your Supabase SQL Editor to check authentication and policies

-- Check if RLS is enabled on the tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('facial_templates', 'facial_recognition_events');

-- Check existing policies on facial_templates
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'facial_templates';

-- Check existing policies on facial_recognition_events
SELECT policyname, cmd, permissive, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'facial_recognition_events';

-- Check current authentication status
SELECT 
  auth.uid() as current_user_id,
  auth.jwt() as current_jwt;

-- Check current user details (if authenticated)
SELECT id, email, tenant_id 
FROM users 
WHERE id = auth.uid();

-- Test if you can see facial_templates table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'facial_templates'
ORDER BY ordinal_position;

-- Test if you can see facial_recognition_events table structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'facial_recognition_events'
ORDER BY ordinal_position;

-- Check if tables exist and are accessible
SELECT COUNT(*) as facial_templates_count FROM facial_templates;
SELECT COUNT(*) as facial_recognition_events_count FROM facial_recognition_events;

-- Try a simple INSERT test (this will fail but show the exact error)
-- Uncomment the line below to test (replace with real values)
-- INSERT INTO facial_templates (person_id, person_type, tenant_id) VALUES ('test-id', 'student', 'your-tenant-id');