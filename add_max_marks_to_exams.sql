-- Migration script to add max_marks field to the exams table
-- This allows each exam to have its own maximum marks setting

ALTER TABLE exams ADD COLUMN max_marks NUMERIC DEFAULT 100 NOT NULL;

-- Update existing exams to have 100 as default max marks
UPDATE exams SET max_marks = 100 WHERE max_marks IS NULL;

-- Add a comment to the column for documentation
COMMENT ON COLUMN exams.max_marks IS 'Maximum marks for this exam (default: 100)';

-- Verify the change
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'exams' AND column_name = 'max_marks';
