-- PRODUCTION SOLUTION: Proper RLS policies for storage
-- Use this after testing with the temporary fix works
-- Run in your Supabase SQL Editor

-- First, re-enable RLS if it was disabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create the profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;

-- Allow authenticated users to INSERT (upload) files to profiles bucket
CREATE POLICY "Authenticated users can upload profile images" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'profiles' AND
    auth.role() = 'authenticated'
);

-- Allow anyone to SELECT (view) files from profiles bucket (since it's public)
CREATE POLICY "Users can view all profile images" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

-- Allow users to UPDATE files they own in profiles bucket
CREATE POLICY "Users can update their own profile images" ON storage.objects
FOR UPDATE USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (storage.foldername(name))[1]
) WITH CHECK (
    bucket_id = 'profiles' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to DELETE files they own in profiles bucket
CREATE POLICY "Users can delete their own profile images" ON storage.objects
FOR DELETE USING (
    bucket_id = 'profiles' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure RLS is enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
