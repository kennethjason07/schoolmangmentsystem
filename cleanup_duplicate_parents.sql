-- CLEANUP SCRIPT: Remove duplicate parent records before adding constraints
-- This script will identify and remove duplicate parent records safely

-- Step 1: Identify duplicate parent records
SELECT 
    'DUPLICATE ANALYSIS' as section,
    email,
    student_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as parent_record_ids,
    STRING_AGG(name, ', ') as parent_names,
    STRING_AGG(created_at::text, ', ') as created_dates
FROM parents
GROUP BY email, student_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Show the specific duplicate causing the error
SELECT 
    'SPECIFIC DUPLICATE FOUND' as section,
    p.*,
    s.name as student_name,
    s.admission_no
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE p.email = 'parent.shrusti@example.com' 
AND p.student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2'
ORDER BY p.created_at;

-- Step 3: Check if these duplicates affect any other tables
SELECT 
    'FOREIGN KEY IMPACT ANALYSIS' as section,
    'students table references' as reference_type,
    COUNT(*) as affected_records
FROM students s
WHERE s.parent_id IN (
    SELECT id FROM parents 
    WHERE email = 'parent.shrusti@example.com' 
    AND student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2'
);

-- Step 4: SAFE CLEANUP - Keep the most recent record, remove older duplicates
-- This uses a window function to identify which record to keep
WITH duplicate_parents AS (
    SELECT 
        id,
        email,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC, id DESC
        ) as row_num
    FROM parents
),
parents_to_delete AS (
    SELECT id 
    FROM duplicate_parents 
    WHERE row_num > 1  -- Keep only the first (most recent) record
)
-- Show what will be deleted (for review)
SELECT 
    'RECORDS TO BE DELETED' as section,
    p.id,
    p.email,
    p.name,
    p.student_id,
    s.name as student_name,
    p.created_at,
    'This duplicate will be removed' as action
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE p.id IN (SELECT id FROM parents_to_delete)
ORDER BY p.email, p.student_id, p.created_at;

-- Step 5: Update any student records that reference the parent records we're about to delete
-- This ensures students.parent_id points to the record we're keeping
WITH duplicate_parents AS (
    SELECT 
        id,
        email,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC, id DESC
        ) as row_num
    FROM parents
),
parents_to_keep AS (
    SELECT id, student_id
    FROM duplicate_parents 
    WHERE row_num = 1  -- The record we're keeping
),
parents_to_delete AS (
    SELECT id, student_id
    FROM duplicate_parents 
    WHERE row_num > 1  -- Records we're deleting
)
UPDATE students 
SET parent_id = (
    SELECT ptk.id 
    FROM parents_to_keep ptk 
    WHERE ptk.student_id = students.id
)
WHERE parent_id IN (SELECT id FROM parents_to_delete);

-- Step 6: Actually delete the duplicate records
WITH duplicate_parents AS (
    SELECT 
        id,
        email,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC, id DESC
        ) as row_num
    FROM parents
)
DELETE FROM parents 
WHERE id IN (
    SELECT id 
    FROM duplicate_parents 
    WHERE row_num > 1
);

-- Step 7: Verify cleanup worked
SELECT 
    'CLEANUP VERIFICATION' as section,
    email,
    student_id,
    COUNT(*) as remaining_count
FROM parents
GROUP BY email, student_id
HAVING COUNT(*) > 1;

-- Step 8: Show summary of cleanup
SELECT 
    'CLEANUP SUMMARY' as section,
    (SELECT COUNT(*) FROM parents) as total_parent_records,
    (SELECT COUNT(DISTINCT CONCAT(email, '|', student_id)) FROM parents) as unique_email_student_combinations,
    CASE 
        WHEN (SELECT COUNT(*) FROM parents) = (SELECT COUNT(DISTINCT CONCAT(email, '|', student_id)) FROM parents)
        THEN 'Ready for unique constraint ✅'
        ELSE 'Still has duplicates ❌'
    END as constraint_ready_status;

-- Step 9: Now try adding the constraint
ALTER TABLE parents 
ADD CONSTRAINT parents_email_student_unique 
UNIQUE (email, student_id);

-- Step 10: Final verification
SELECT 
    'FINAL VERIFICATION' as section,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'parents' 
AND constraint_name = 'parents_email_student_unique';
