-- Add profile_url column to users table
-- Run this in your Supabase SQL Editor

-- Add the profile_url column if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_url TEXT;

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_users_profile_url ON public.users(profile_url);

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
AND column_name = 'profile_url';
