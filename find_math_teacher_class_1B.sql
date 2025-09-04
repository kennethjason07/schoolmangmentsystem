-- Find the mathematics teacher for class 1 B
-- This query joins multiple tables to find the teacher assigned to teach mathematics in class 1 B

SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    t.phone as teacher_phone,
    t.qualification,
    s.name as subject_name,
    c.class_name,
    c.section,
    c.academic_year,
    ts.assigned_on as assignment_date
FROM 
    public.teachers t
    INNER JOIN public.teacher_subjects ts ON t.id = ts.teacher_id
    INNER JOIN public.subjects s ON ts.subject_id = s.id
    INNER JOIN public.classes c ON s.class_id = c.id
WHERE 
    c.class_name = '1'
    AND c.section = 'B'
    AND (s.name ILIKE '%math%' OR s.name ILIKE '%mathematics%')
    -- Add tenant filter if needed
    -- AND t.tenant_id = 'your-tenant-id-here'
ORDER BY 
    ts.assigned_on DESC;

-- Alternative query if you want to include class teacher information as well
-- (in case the mathematics teacher is also the class teacher)

SELECT 
    t.id as teacher_id,
    t.name as teacher_name,
    t.phone as teacher_phone,
    t.qualification,
    t.is_class_teacher,
    CASE 
        WHEN t.id = c.class_teacher_id THEN 'Yes'
        ELSE 'No'
    END as is_class_teacher_for_this_class,
    s.name as subject_name,
    c.class_name,
    c.section,
    c.academic_year,
    ts.assigned_on as assignment_date
FROM 
    public.teachers t
    INNER JOIN public.teacher_subjects ts ON t.id = ts.teacher_id
    INNER JOIN public.subjects s ON ts.subject_id = s.id
    INNER JOIN public.classes c ON s.class_id = c.id
WHERE 
    c.class_name = '1'
    AND c.section = 'B'
    AND (s.name ILIKE '%math%' OR s.name ILIKE '%mathematics%')
    -- Add tenant filter if needed
    -- AND t.tenant_id = 'your-tenant-id-here'
ORDER BY 
    ts.assigned_on DESC;

-- If you need to filter by a specific tenant, uncomment and replace with actual tenant ID:
-- AND t.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
