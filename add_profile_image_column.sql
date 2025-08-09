-- Add profile_url column to users table for storing profile images
-- Run this SQL in your Supabase SQL editor

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_url TEXT;

-- Add a comment to document this column
COMMENT ON COLUMN public.users.profile_url IS 'URL to user profile image stored in Supabase storage';

-- Create an index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_users_profile_url ON public.users(profile_url) WHERE profile_url IS NOT NULL;
