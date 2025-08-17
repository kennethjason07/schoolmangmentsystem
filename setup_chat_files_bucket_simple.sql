-- Simple Chat-Files Bucket Setup (matching working profiles setup)
-- Run this SQL in your Supabase SQL Editor

-- Create the chat-files storage bucket (keep it simple like profiles)
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

-- Create simple policies (matching the working profiles bucket policies)

-- Policy 1: Allow authenticated users to upload files to chat-files bucket
CREATE POLICY "Enable upload for authenticated users on chat-files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow all users to read files from chat-files bucket (public bucket)
CREATE POLICY "Enable read for all users on chat-files" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-files');

-- Policy 3: Allow users to update their own files (filename contains user ID)
CREATE POLICY "Enable update for users based on user_id on chat-files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
) WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
);

-- Policy 4: Allow users to delete their own files (filename contains user ID)
CREATE POLICY "Enable delete for users based on user_id on chat-files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(name, '_', 1)
);

-- Verify the setup
SELECT 'chat-files bucket created successfully' as status;
SELECT 'Policies created successfully' as status;
