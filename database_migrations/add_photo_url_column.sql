-- ==========================================
-- ADD PHOTO_URL COLUMN TO STUDENTS TABLE
-- ==========================================
-- Date: 2025-01-03
-- Description: Adds photo_url column to store student photo URLs

-- Add photo_url column to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.students.photo_url IS 'URL to student photo stored in Supabase Storage';

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'students' 
  AND column_name = 'photo_url'
  AND table_schema = 'public';

-- Show success message
SELECT 'photo_url column added successfully to students table' as status;