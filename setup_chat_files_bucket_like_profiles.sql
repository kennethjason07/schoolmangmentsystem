-- Setup Supabase Storage for Chat Files (using same logic as profiles bucket)
-- Run this SQL in your Supabase SQL editor

-- Create the chat-files storage bucket if it doesn't exist (public like profiles)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Chat files upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files read policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files update policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Enable upload for authenticated users on chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Enable read for all users on chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for users based on user_id on chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for users based on user_id on chat-files" ON storage.objects;

-- Set up storage policies for chat files (EXACT SAME LOGIC AS PROFILES BUCKET)

-- Policy to allow authenticated users to upload their own chat files
-- Uses folder structure: user_id/filename (same as profiles)
CREATE POLICY "Users can upload their own chat files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to update their own chat files  
CREATE POLICY "Users can update their own chat files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'chat-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to delete their own chat files
CREATE POLICY "Users can delete their own chat files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow everyone to view chat files (since bucket is public)
CREATE POLICY "Anyone can view chat files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'chat-files');

-- Verify the setup
SELECT 'chat-files bucket created successfully with profiles-style policies' as status;

-- Check bucket configuration
SELECT id, name, public, created_at 
FROM storage.buckets 
WHERE id = 'chat-files';

-- Check policies
SELECT policyname, cmd, roles, qual 
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects' 
AND policyname LIKE '%chat files%';
