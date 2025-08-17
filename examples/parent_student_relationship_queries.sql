-- Sample Queries for Parent-Student Relationships
-- This file demonstrates how to work with the new junction table structure

-- ******** IMPORTANT: REPLACE PLACEHOLDERS BEFORE RUNNING ********
-- This file contains example queries with placeholder UUIDs like 'parent_uuid_here'.
-- Before running any of these queries, replace the placeholders with actual UUIDs from your database.
-- For example, replace 'parent_uuid_here' with an actual UUID like '123e4567-e89b-12d3-a456-426614174000'
-- **************************************************************

-- ========================================
-- BASIC OPERATIONS
-- ========================================

-- 1. Add a new parent-student relationship
-- Example: Adding a mother as primary contact for a student
-- NOTE: Replace the UUIDs below with actual UUIDs from your database!
/*
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact)
VALUES (
    '123e4567-e89b-12d3-a456-426614174000',  -- Replace with actual parent UUID
    '123e4567-e89b-12d3-a456-426614174001',  -- Replace with actual student UUID
    'Mother',
    true
);
*/

-- 2. Add multiple children for the same parent
-- Example: A father has 3 children in the school
-- NOTE: Replace the UUIDs below with actual UUIDs from your database!
/*
INSERT INTO public.parent_student_relationships (parent_id, student_id, relationship_type, is_primary_contact) VALUES
    ('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174001', 'Father', true),
    ('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174002', 'Father', false),
    ('123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174003', 'Father', false);
*/

-- ========================================
-- QUERY EXAMPLES USING VIEWS
-- ========================================

-- 3. Get all children of a specific parent
-- NOTE: Replace the UUID below with an actual parent UUID from your database!
SELECT * FROM public.v_parents_with_children 
WHERE parent_id = '123e4567-e89b-12d3-a456-426614174000';  -- Replace with actual parent UUID

-- 4. Get all contacts for a specific student
-- NOTE: Replace the UUID below with an actual student UUID from your database!
SELECT * FROM public.v_students_with_contacts 
WHERE student_id = '123e4567-e89b-12d3-a456-426614174001';  -- Replace with actual student UUID

-- 5. Get complete relationship details
SELECT * FROM public.v_parent_student_details 
WHERE parent_name LIKE '%Smith%';

-- ========================================
-- ADVANCED QUERIES
-- ========================================

-- 6. Find parents with multiple children
SELECT 
    parent_name,
    parent_phone,
    total_children,
    children_names
FROM public.v_parents_with_children 
WHERE total_children > 1
ORDER BY total_children DESC;

-- 7. Find students who have multiple parent contacts
SELECT 
    student_name,
    admission_no,
    class_name,
    section,
    total_contacts,
    contact_names
FROM public.v_students_with_contacts 
WHERE total_contacts > 1
ORDER BY total_contacts DESC;

-- 8. Get primary contact information for all students
SELECT 
    s.admission_no,
    s.name as student_name,
    c.class_name,
    c.section,
    p.name as primary_contact_name,
    p.phone as primary_contact_phone,
    psr.relationship_type
FROM public.students s
JOIN public.parent_student_relationships psr ON s.id = psr.student_id AND psr.is_primary_contact = true
JOIN public.parents p ON psr.parent_id = p.id
LEFT JOIN public.classes c ON s.class_id = c.id
ORDER BY c.class_name, c.section, s.name;

-- 9. Find students without any parent contact
SELECT 
    s.admission_no,
    s.name as student_name,
    c.class_name,
    c.section
FROM public.students s
LEFT JOIN public.parent_student_relationships psr ON s.id = psr.student_id
LEFT JOIN public.classes c ON s.class_id = c.id
WHERE psr.student_id IS NULL;

-- 10. Get emergency contacts for all students
SELECT 
    s.admission_no,
    s.name as student_name,
    p.name as emergency_contact_name,
    p.phone as emergency_contact_phone,
    psr.relationship_type
FROM public.students s
JOIN public.parent_student_relationships psr ON s.id = psr.student_id AND psr.is_emergency_contact = true
JOIN public.parents p ON psr.parent_id = p.id
ORDER BY s.name;

-- ========================================
-- REPORTING QUERIES
-- ========================================

-- 11. Parent contact summary by class
SELECT 
    c.class_name,
    c.section,
    COUNT(DISTINCT s.id) as total_students,
    COUNT(DISTINCT CASE WHEN psr.is_primary_contact THEN s.id END) as students_with_primary_contact,
    COUNT(DISTINCT CASE WHEN psr.is_emergency_contact THEN s.id END) as students_with_emergency_contact,
    ROUND(
        COUNT(DISTINCT CASE WHEN psr.is_primary_contact THEN s.id END) * 100.0 / COUNT(DISTINCT s.id), 
        2
    ) as primary_contact_percentage
FROM public.classes c
LEFT JOIN public.students s ON c.id = s.class_id
LEFT JOIN public.parent_student_relationships psr ON s.id = psr.student_id
GROUP BY c.id, c.class_name, c.section
ORDER BY c.class_name, c.section;

-- 12. Most common relationship types
SELECT 
    relationship_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM public.parent_student_relationships), 2) as percentage
FROM public.parent_student_relationships
GROUP BY relationship_type
ORDER BY count DESC;

-- ========================================
-- MAINTENANCE QUERIES
-- ========================================

-- 13. Update a parent's contact information (affects all their children)
-- NOTE: Replace the UUID below with an actual parent UUID from your database!
UPDATE public.parents 
SET phone = 'new_phone_number', 
    email = 'new_email@example.com'
WHERE id = '123e4567-e89b-12d3-a456-426614174000';  -- Replace with actual parent UUID

-- 14. Change primary contact for a student
-- NOTE: Replace the UUIDs below with actual UUIDs from your database!

-- First, remove primary status from current primary contact
/*
UPDATE public.parent_student_relationships 
SET is_primary_contact = false 
WHERE student_id = '123e4567-e89b-12d3-a456-426614174001' AND is_primary_contact = true;

-- Then, set new primary contact
UPDATE public.parent_student_relationships 
SET is_primary_contact = true 
WHERE parent_id = '123e4567-e89b-12d3-a456-426614174999' AND student_id = '123e4567-e89b-12d3-a456-426614174001';
*/

-- 15. Remove a parent-student relationship
-- NOTE: Replace the UUIDs below with actual UUIDs from your database!
/*
DELETE FROM public.parent_student_relationships 
WHERE parent_id = '123e4567-e89b-12d3-a456-426614174000' AND student_id = '123e4567-e89b-12d3-a456-426614174001';
*/
