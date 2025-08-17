-- Fix Supabase Storage Policies for chat-files bucket
-- Run this in your Supabase SQL Editor

-- 1. Enable RLS on storage.objects if not already enabled
-- (This might already be enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies for chat-files bucket (if any)
DROP POLICY IF EXISTS "chat_files_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_delete_policy" ON storage.objects;

-- 3. Create comprehensive policies for chat-files bucket

-- Allow authenticated users to SELECT files from chat-files bucket
CREATE POLICY "chat_files_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'chat-files');

-- Allow authenticated users to INSERT files into chat-files bucket
CREATE POLICY "chat_files_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'chat-files');

-- Allow users to UPDATE their own files in chat-files bucket
CREATE POLICY "chat_files_update_policy" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'chat-files' AND auth.uid()::text = owner)
    WITH CHECK (bucket_id = 'chat-files');

-- Allow users to DELETE their own files in chat-files bucket
CREATE POLICY "chat_files_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'chat-files' AND auth.uid()::text = owner);

-- 4. Ensure the chat-files bucket exists and is properly configured
-- (This should already exist based on your diagnostics, but just in case)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-files', 'chat-files', true, 104857600, ARRAY['image/*', 'application/pdf', 'text/*', 'application/*'])
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY['image/*', 'application/pdf', 'text/*', 'application/*'];

-- 5. Verify the policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%chat_files%'
ORDER BY policyname;
