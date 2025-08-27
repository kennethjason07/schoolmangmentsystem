-- Check parent-student relationships for your specific class
-- Replace this class ID with yours: 37b82e22-ff67-45f7-9df4-1e0201376fb9

-- 1. Check students in the class
SELECT 'STUDENTS IN CLASS' as check_type, 
       s.id, 
       s.name as student_name, 
       s.parent_id,
       s.class_id
FROM students s 
WHERE s.class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9';

-- 2. Check parents table
SELECT 'PARENTS TABLE' as check_type,
       p.id,
       p.name as parent_name,
       p.email,
       p.student_id
FROM parents p;

-- 3. Check users with parent role (role_id = 3)
SELECT 'PARENT USERS' as check_type,
       u.id,
       u.full_name,
       u.email,
       u.role_id,
       u.linked_parent_of
FROM users u 
WHERE u.role_id = 3;

-- 4. Check for parent-student links
SELECT 'PARENT-STUDENT LINKS' as check_type,
       s.name as student_name,
       p.name as parent_name,
       p.email as parent_email,
       u.id as parent_user_id,
       u.full_name as parent_user_name
FROM students s
LEFT JOIN parents p ON (s.parent_id = p.id OR p.student_id = s.id)
LEFT JOIN users u ON (p.email = u.email AND u.role_id = 3)
WHERE s.class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9';

-- 5. Test the notification function directly
SELECT 'NOTIFICATION FUNCTION TEST' as check_type,
       get_class_parent_ids('37b82e22-ff67-45f7-9df4-1e0201376fb9');
