-- Utility Queries to Find Actual UUIDs in Your Database
-- Use these queries to find real UUIDs that you can use in the example queries

-- ========================================
-- FIND PARENT UUIDs
-- ========================================

-- 1. Get all parents with their UUIDs (first 10)
SELECT 
    id as parent_uuid,
    name as parent_name,
    phone,
    email
FROM public.parents 
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- FIND STUDENT UUIDs
-- ========================================

-- 2. Get all students with their UUIDs (first 10)
SELECT 
    id as student_uuid,
    admission_no,
    name as student_name,
    academic_year
FROM public.students 
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- FIND EXISTING RELATIONSHIPS
-- ========================================

-- 3. Check if you already have data in the junction table
SELECT 
    psr.id as relationship_uuid,
    psr.parent_id,
    p.name as parent_name,
    psr.student_id,
    s.name as student_name,
    s.admission_no,
    psr.relationship_type,
    psr.is_primary_contact
FROM public.parent_student_relationships psr
JOIN public.parents p ON psr.parent_id = p.id
JOIN public.students s ON psr.student_id = s.id
ORDER BY p.name, s.name
LIMIT 10;

-- ========================================
-- USEFUL COMBINATIONS FOR TESTING
-- ========================================

-- 4. Find a parent and student pair that you can use for testing
-- (This gets the first parent and first student - you can modify as needed)
SELECT 
    'Parent UUID: ' || p.id as parent_info,
    'Student UUID: ' || s.id as student_info,
    'Parent Name: ' || p.name as parent_name,
    'Student Name: ' || s.name || ' (' || s.admission_no || ')' as student_info_detailed
FROM public.parents p
CROSS JOIN public.students s
LIMIT 5;

-- ========================================
-- SAMPLE INSERT STATEMENT GENERATOR
-- ========================================

-- 5. Generate a ready-to-use INSERT statement with actual UUIDs
-- This will create INSERT statements you can copy and paste
SELECT 
    'INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact) VALUES (''' 
    || p.id || ''', ''' 
    || s.id || ''', ''Father'', true);' as ready_to_use_insert_statement
FROM public.parents p
CROSS JOIN public.students s
LIMIT 3;

-- ========================================
-- COUNT CHECKS
-- ========================================

-- 6. Check how many records you have in each table
SELECT 'parents' as table_name, COUNT(*) as record_count FROM public.parents
UNION ALL
SELECT 'students' as table_name, COUNT(*) as record_count FROM public.students
UNION ALL
SELECT 'parent_student_relationships' as table_name, COUNT(*) as record_count FROM public.parent_student_relationships;

-- ========================================
-- FIND STUDENTS WITHOUT PARENT RELATIONSHIPS
-- ========================================

-- 7. Find students who don't have any parent relationships yet
SELECT 
    s.id as student_uuid,
    s.admission_no,
    s.name as student_name,
    'No parent relationships found' as status
FROM public.students s
LEFT JOIN public.parent_student_relationships psr ON s.id = psr.student_id
WHERE psr.student_id IS NULL
LIMIT 10;
