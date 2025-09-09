-- Debug script to investigate parent-student relationship issues
-- Run these queries to understand why a parent is seeing multiple children

-- 1. Check the user account that's experiencing the issue
-- Replace 'parent_email@example.com' with the actual parent's email
SELECT 
    id, 
    email, 
    full_name, 
    linked_parent_of, 
    linked_student_id,
    created_at
FROM users 
WHERE email = 'parent_email@example.com';  -- Replace with actual email

-- 2. Check all parent records associated with this email
SELECT 
    p.id,
    p.name,
    p.email,
    p.phone,
    p.student_id,
    p.relation,
    s.name as student_name,
    s.admission_no,
    s.class_id,
    c.class_name,
    c.section
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
LEFT JOIN classes c ON s.class_id = c.id
WHERE p.email = 'parent_email@example.com'  -- Replace with actual email
ORDER BY p.created_at;

-- 3. Check if there are students linked to this parent user via linked_parent_of
SELECT 
    s.id,
    s.name,
    s.admission_no,
    s.roll_no,
    s.parent_id,
    c.class_name,
    c.section,
    u.email as linked_user_email
FROM students s
LEFT JOIN classes c ON s.class_id = c.id
LEFT JOIN users u ON u.linked_parent_of = s.id
WHERE u.email = 'parent_email@example.com';  -- Replace with actual email

-- 4. Check for duplicate parent records (same student with multiple parents)
SELECT 
    s.name as student_name,
    s.admission_no,
    COUNT(p.id) as parent_count,
    STRING_AGG(p.email, ', ') as parent_emails,
    STRING_AGG(p.name, ', ') as parent_names
FROM students s
LEFT JOIN parents p ON p.student_id = s.id
WHERE s.id IN (
    SELECT DISTINCT student_id 
    FROM parents 
    WHERE email = 'parent_email@example.com'  -- Replace with actual email
)
GROUP BY s.id, s.name, s.admission_no
HAVING COUNT(p.id) > 1;

-- 5. Check for data consistency issues
SELECT 
    'Orphaned parent records' as issue_type,
    COUNT(*) as count
FROM parents p
LEFT JOIN students s ON p.student_id = s.id
WHERE s.id IS NULL

UNION ALL

SELECT 
    'Students without parent records' as issue_type,
    COUNT(*) as count
FROM students s
LEFT JOIN parents p ON p.student_id = s.id
WHERE p.id IS NULL AND s.parent_id IS NOT NULL

UNION ALL

SELECT 
    'Mismatched parent_id and parent records' as issue_type,
    COUNT(*) as count
FROM students s
LEFT JOIN parents p ON p.student_id = s.id
WHERE s.parent_id IS NOT NULL 
  AND (p.id IS NULL OR p.id != s.parent_id);
