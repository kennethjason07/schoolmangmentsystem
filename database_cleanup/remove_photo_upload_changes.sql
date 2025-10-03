-- ==========================================
-- CLEANUP: Remove Photo Upload Changes
-- ==========================================
-- Date: 2025-01-03
-- Description: Removes all photo upload related database changes to start fresh

-- Remove photo_url column from students table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'students' 
        AND column_name = 'photo_url'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.students DROP COLUMN photo_url;
        RAISE NOTICE 'Removed photo_url column from students table';
    ELSE
        RAISE NOTICE 'photo_url column does not exist in students table';
    END IF;
END $$;

-- Clean up any photo-related functions if they exist
DROP FUNCTION IF EXISTS public.upload_student_photo(uuid, text, text);
DROP FUNCTION IF EXISTS public.delete_student_photo(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_student_photos(uuid);

-- Report completion
SELECT 'Database cleanup completed successfully' as status;