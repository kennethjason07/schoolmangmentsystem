-- Setup Supabase Storage for Profile Images
-- Run this SQL in your Supabase SQL editor

-- Create the profiles storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Set up storage policies for profile images

-- Policy to allow authenticated users to upload their own profile images
CREATE POLICY "Users can upload their own profile image" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to update their own profile images  
CREATE POLICY "Users can update their own profile image" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow authenticated users to delete their own profile images
CREATE POLICY "Users can delete their own profile image" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profiles' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy to allow everyone to view profile images (since bucket is public)
CREATE POLICY "Anyone can view profile images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profiles');
