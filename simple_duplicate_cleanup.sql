-- SIMPLE DUPLICATE CLEANUP - Run these queries one by one

-- Step 1: See the duplicate records causing the issue
SELECT 
    p.id,
    p.email,
    p.name,
    p.student_id,
    s.name as student_name,
    s.admission_no,
    p.created_at
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE p.email = 'parent.shrusti@example.com' 
AND p.student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2'
ORDER BY p.created_at DESC;

-- Step 2: Check how many total duplicates exist in your system
SELECT 
    email,
    student_id,
    COUNT(*) as duplicate_count
FROM parents
GROUP BY email, student_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 3: SAFE APPROACH - First, let's identify which record to keep and which to delete
-- This will show you exactly what will be deleted (RUN THIS FIRST TO REVIEW)
WITH ranked_parents AS (
    SELECT 
        id,
        email,
        name,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC
        ) as rank
    FROM parents
)
SELECT 
    rp.id,
    rp.email,
    rp.name,
    rp.student_id,
    s.name as student_name,
    rp.created_at,
    CASE 
        WHEN rp.rank = 1 THEN 'KEEP (most recent)' 
        ELSE 'DELETE (duplicate)' 
    END as action
FROM ranked_parents rp
LEFT JOIN students s ON rp.student_id = s.id
WHERE rp.email = 'parent.shrusti@example.com' 
AND rp.student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2'
ORDER BY rp.created_at DESC;

-- Step 4: If Step 3 looks good, run this to delete the duplicates
-- (Replace the email and student_id with your actual values if different)
WITH ranked_parents AS (
    SELECT 
        id,
        email,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC
        ) as rank
    FROM parents
)
DELETE FROM parents 
WHERE id IN (
    SELECT id 
    FROM ranked_parents 
    WHERE rank > 1 
    AND email = 'parent.shrusti@example.com' 
    AND student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2'
);

-- Step 5: Verify the duplicate is gone
SELECT 
    p.id,
    p.email,
    p.name,
    p.student_id,
    s.name as student_name,
    p.created_at
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE p.email = 'parent.shrusti@example.com' 
AND p.student_id = '17f3ca49-845c-4a09-b735-012496e3f6c2';

-- Step 6: Clean up ALL duplicates in the system (optional)
-- Only run this if you want to clean up all duplicates at once
-- UNCOMMENT THE LINES BELOW IF YOU WANT TO CLEAN ALL DUPLICATES

/*
WITH ranked_parents AS (
    SELECT 
        id,
        email,
        student_id,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY email, student_id 
            ORDER BY created_at DESC
        ) as rank
    FROM parents
)
DELETE FROM parents 
WHERE id IN (
    SELECT id 
    FROM ranked_parents 
    WHERE rank > 1
);
*/

-- Step 7: After cleanup, try adding the constraint again
-- ALTER TABLE parents ADD CONSTRAINT parents_email_student_unique UNIQUE (email, student_id);
