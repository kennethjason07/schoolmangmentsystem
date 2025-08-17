-- Setup Supabase Storage for Chat Files
-- Run this SQL in your Supabase SQL editor

-- Create the chat-files storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', true, 104857600, ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-zip-compressed'
])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600, -- 100MB limit
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip', 'application/x-zip-compressed'
  ],
  updated_at = NOW();

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Chat files upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files read policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files update policy" ON storage.objects;
DROP POLICY IF EXISTS "Chat files delete policy" ON storage.objects;

-- Policy 1: Allow authenticated users to upload chat files
-- File naming convention: chat-files/{message_id}/{timestamp}_{original_filename}
CREATE POLICY "Chat files upload policy" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow public read access to chat files (since messages are accessible to participants)
CREATE POLICY "Chat files read policy" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'chat-files');

-- Policy 3: Allow message sender to update their chat files
CREATE POLICY "Chat files update policy" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(split_part(name, '/', 2), '_', 1)
) WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(split_part(name, '/', 2), '_', 1)
);

-- Policy 4: Allow message sender to delete their chat files
CREATE POLICY "Chat files delete policy" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = split_part(split_part(name, '/', 2), '_', 1)
);

-- Comment explaining the file structure
-- Files will be organized as: chat-files/{message_id}/{sender_user_id}_{timestamp}_{filename}
-- Example: chat-files/abc123-def456/user789_1640995200000_document.pdf
