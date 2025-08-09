-- SUPABASE STORAGE POLICIES FIX
-- Run this in your Supabase SQL Editor
-- This works with Supabase's storage system without needing table owner permissions

-- Create the profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  updated_at = NOW();

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable read for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files to profiles bucket
CREATE POLICY "Enable upload for authenticated users" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profiles' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow all users to read files from profiles bucket (public bucket)
CREATE POLICY "Enable read for all users" ON storage.objects
FOR SELECT USING (bucket_id = 'profiles');

-- Policy 3: Allow users to update their own files (filename contains user ID)
CREATE POLICY "Enable update for users based on user_id" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profiles' AND
  auth.uid()::text = split_part(name, '_', 1)
) WITH CHECK (
  bucket_id = 'profiles' AND
  auth.uid()::text = split_part(name, '_', 1)
);

-- Policy 4: Allow users to delete their own files (filename contains user ID)
CREATE POLICY "Enable delete for users based on user_id" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profiles' AND
  auth.uid()::text = split_part(name, '_', 1)
);
