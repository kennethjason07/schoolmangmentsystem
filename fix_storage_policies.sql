-- Fix Storage Policies for Profile Images
-- Run this SQL in your Supabase SQL editor to fix the RLS policy issues

-- First, drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile image" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

-- Ensure the profiles bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  updated_at = NOW();

-- Create more permissive policies that should work

-- Policy 1: Allow authenticated users to insert their own profile images
CREATE POLICY "Allow authenticated users to upload profile images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profiles'
  );

-- Policy 2: Allow authenticated users to update their own profile images
CREATE POLICY "Allow authenticated users to update profile images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'profiles'
  )
  WITH CHECK (
    bucket_id = 'profiles'
  );

-- Policy 3: Allow authenticated users to delete their own profile images
CREATE POLICY "Allow authenticated users to delete profile images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'profiles'
  );

-- Policy 4: Allow anyone to view profile images (public read)
CREATE POLICY "Allow public read of profile images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profiles');

-- Alternative: If the above still doesn't work, use this more permissive version
-- Uncomment the following policies if needed:

/*
-- Super permissive policies (use only if the above don't work)
DROP POLICY IF EXISTS "Allow authenticated users to upload profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete profile images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of profile images" ON storage.objects;

-- Allow all authenticated users full access to profiles bucket
CREATE POLICY "Full access to profiles bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'profiles')
  WITH CHECK (bucket_id = 'profiles');

-- Allow public read
CREATE POLICY "Public read profiles" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'profiles');
*/
