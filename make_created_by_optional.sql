-- Alternative Solution: Make created_by field optional
-- This removes the NOT NULL constraint and the foreign key constraint if they're too restrictive

-- First, check the current structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'created_by';

-- Check current foreign key constraints
SELECT
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='events'
  AND kcu.column_name = 'created_by';

-- Option 1: Drop the foreign key constraint entirely (less restrictive)
-- ALTER TABLE events DROP CONSTRAINT IF EXISTS events_created_by_fkey;

-- Option 2: Recreate the foreign key constraint with ON DELETE SET NULL
-- This allows events to remain even if the user is deleted
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'events_created_by_fkey' 
        AND table_name = 'events'
    ) THEN
        ALTER TABLE events DROP CONSTRAINT events_created_by_fkey;
    END IF;
    
    -- Recreate with CASCADE options
    ALTER TABLE events 
    ADD CONSTRAINT events_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES users(id) 
    ON DELETE SET NULL 
    ON UPDATE CASCADE;
    
END $$;

-- Make sure the column allows NULL values
ALTER TABLE events ALTER COLUMN created_by DROP NOT NULL;

-- Clean up any existing invalid references
UPDATE events 
SET created_by = NULL 
WHERE created_by IS NOT NULL 
  AND created_by NOT IN (SELECT id FROM users);

-- Verify the changes
SELECT 'Updated constraint information:' as section;

SELECT
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule,
  rc.update_rule
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
  LEFT JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name='events'
  AND kcu.column_name = 'created_by';

-- Show final column information
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'events' AND column_name = 'created_by';
