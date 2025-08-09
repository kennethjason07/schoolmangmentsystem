-- TEMPORARY FIX: Disable RLS on storage.objects for testing
-- Run this in your Supabase SQL Editor to get profile uploads working immediately
-- This is a temporary solution to test the functionality

-- Disable RLS on storage.objects temporarily
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Make sure the profiles bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- IMPORTANT: After confirming uploads work, you should re-enable RLS with proper policies
-- To re-enable later (after testing), run:
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
