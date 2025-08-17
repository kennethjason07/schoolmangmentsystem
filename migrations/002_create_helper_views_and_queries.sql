-- Helper Views and Queries for Parent-Student Relationships
-- These views and sample queries help you work with the new junction table structure

-- View 1: Complete parent-student information with relationship details
CREATE OR REPLACE VIEW public.v_parent_student_details AS
SELECT 
    psr.id as relationship_id,
    p.id as parent_id,
    p.name as parent_name,
    p.phone as parent_phone,
    p.email as parent_email,
    s.id as student_id,
    s.admission_no,
    s.name as student_name,
    s.academic_year as student_academic_year,
    c.class_name,
    c.section,
    psr.relationship_type,
    psr.is_primary_contact,
    psr.is_emergency_contact,
    psr.notes,
    psr.created_at as relationship_created_at
FROM public.parent_student_relationships psr
JOIN public.parents p ON psr.parent_id = p.id
JOIN public.students s ON psr.student_id = s.id
LEFT JOIN public.classes c ON s.class_id = c.id;

-- View 2: Parents with all their children
CREATE OR REPLACE VIEW public.v_parents_with_children AS
SELECT 
    p.id as parent_id,
    p.name as parent_name,
    p.phone as parent_phone,
    p.email as parent_email,
    COUNT(psr.student_id) as total_children,
    ARRAY_AGG(s.name ORDER BY s.name) as children_names,
    ARRAY_AGG(s.admission_no ORDER BY s.name) as children_admission_nos,
    ARRAY_AGG(psr.relationship_type ORDER BY s.name) as relationship_types
FROM public.parents p
JOIN public.parent_student_relationships psr ON p.id = psr.parent_id
JOIN public.students s ON psr.student_id = s.id
GROUP BY p.id, p.name, p.phone, p.email;

-- View 3: Students with all their parent/guardian contacts
CREATE OR REPLACE VIEW public.v_students_with_contacts AS
SELECT 
    s.id as student_id,
    s.admission_no,
    s.name as student_name,
    s.academic_year,
    c.class_name,
    c.section,
    COUNT(psr.parent_id) as total_contacts,
    ARRAY_AGG(p.name ORDER BY psr.is_primary_contact DESC, p.name) as contact_names,
    ARRAY_AGG(p.phone ORDER BY psr.is_primary_contact DESC, p.name) as contact_phones,
    ARRAY_AGG(p.email ORDER BY psr.is_primary_contact DESC, p.name) as contact_emails,
    ARRAY_AGG(psr.relationship_type ORDER BY psr.is_primary_contact DESC, p.name) as relationship_types,
    ARRAY_AGG(psr.is_primary_contact ORDER BY psr.is_primary_contact DESC, p.name) as is_primary_contacts
FROM public.students s
JOIN public.parent_student_relationships psr ON s.id = psr.student_id
JOIN public.parents p ON psr.parent_id = p.id
LEFT JOIN public.classes c ON s.class_id = c.id
GROUP BY s.id, s.admission_no, s.name, s.academic_year, c.class_name, c.section;
