-- =============================================================================
-- CASTE VALUES DATABASE MIGRATION
-- =============================================================================
-- This script migrates caste values from old system to new system
-- Correct Mapping:
-- OC → OBC
-- BC → OBC  
-- Other → GENERAL
-- SC → SC (unchanged)
-- ST → ST (unchanged)
-- =============================================================================

-- Step 1: Check current data distribution BEFORE migration
SELECT 'BEFORE MIGRATION:' as info, caste, COUNT(*) as count 
FROM public.students 
WHERE caste IS NOT NULL 
GROUP BY caste 
ORDER BY caste;

-- Step 2: Update existing data to new values

-- Update OC to OBC
UPDATE public.students 
SET caste = 'OBC' 
WHERE caste = 'OC';

-- Update BC to OBC  
UPDATE public.students 
SET caste = 'OBC' 
WHERE caste = 'BC';

-- Update Other to GENERAL
UPDATE public.students 
SET caste = 'GENERAL' 
WHERE caste = 'Other';

-- SC and ST remain unchanged (no update needed)

-- Step 3: Check data distribution AFTER migration
SELECT 'AFTER MIGRATION:' as info, caste, COUNT(*) as count 
FROM public.students 
WHERE caste IS NOT NULL 
GROUP BY caste 
ORDER BY caste;

-- Step 4: Drop the old constraint
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_caste_check;

-- Step 5: Add new constraint with updated values
ALTER TABLE public.students 
ADD CONSTRAINT students_caste_check 
CHECK (caste = ANY (ARRAY['SC'::text, 'ST'::text, 'OBC'::text, 'GENERAL'::text]));

-- Step 6: Verify constraint was created successfully
SELECT 'NEW CONSTRAINT:' as info, conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.students'::regclass 
AND conname = 'students_caste_check';

-- Step 7: Final validation - ensure all data complies with new constraint
SELECT 
  'VALIDATION:' as info,
  CASE 
    WHEN COUNT(*) = 0 THEN 'SUCCESS: All students have valid caste values'
    ELSE CONCAT('ERROR: ', COUNT(*), ' students have invalid caste values')
  END as result
FROM public.students 
WHERE caste IS NOT NULL 
AND caste NOT IN ('SC', 'ST', 'OBC', 'GENERAL');