-- SQL commands to fix RLS policies for school logo uploads
-- Run these in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Option 1: Add a specific policy for school logos (Recommended)
CREATE POLICY "Allow school logo uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profiles' 
    AND (
      -- Allow normal profile picture uploads (existing functionality)
      (storage.foldername(name))[1] = auth.uid()::text
      OR 
      -- Allow school logo uploads with any naming pattern for authenticated users
      name LIKE '%school%' 
    )
  );

-- Option 2: Temporarily make uploads more permissive (Less secure but works)
-- Uncomment the lines below if Option 1 doesn't work

-- DROP POLICY IF EXISTS "Users can upload their own profile image" ON storage.objects;
-- CREATE POLICY "Authenticated users can upload to profiles bucket" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'profiles');

-- Option 3: Check existing policies (Run this first to see what's currently configured)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- After running the above, check if the policies look correct
-- You should see policies that allow authenticated users to upload to the profiles bucket

-- If you need to completely reset the policies, uncomment below:
-- DROP POLICY IF EXISTS "Users can upload their own profile image" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update their own profile image" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete their own profile image" ON storage.objects;
-- DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;

-- Then re-run the original setup from setup_profile_storage.sql
