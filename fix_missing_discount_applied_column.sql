-- Fix missing discount_applied column in fee_structure table
-- This SQL script adds the missing column that's referenced in schema.txt but doesn't exist in the database

-- Check if the column exists first
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'fee_structure' 
        AND column_name = 'discount_applied'
    ) THEN
        -- Add the missing column
        ALTER TABLE public.fee_structure 
        ADD COLUMN discount_applied numeric DEFAULT 0;
        
        RAISE NOTICE '✅ Added missing discount_applied column to fee_structure table';
    ELSE
        RAISE NOTICE '📋 discount_applied column already exists in fee_structure table';
    END IF;
END $$;

-- Verify the column was added
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'fee_structure'
AND column_name = 'discount_applied';

-- Test message
SELECT '🎯 Fix completed! The discount_applied column should now exist in fee_structure table.' as result;
