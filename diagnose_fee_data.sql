-- ============================================================
-- DIAGNOSTIC QUERIES TO CHECK FEE DATA AND IDENTIFY ISSUES
-- ============================================================

-- 1. Check Justus's student data
SELECT 
    'JUSTUS STUDENT DATA' as section,
    s.id as student_id,
    s.name,
    s.class_id,
    s.academic_year as student_academic_year,
    s.tenant_id,
    c.class_name,
    c.section,
    c.academic_year as class_academic_year
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id
WHERE s.name ILIKE '%justus%'
ORDER BY s.name;

-- 2. Check Justus's fee payment records
SELECT 
    'JUSTUS FEE PAYMENTS' as section,
    sf.id,
    sf.fee_component,
    sf.amount_paid,
    sf.academic_year,
    sf.total_amount,
    sf.remaining_amount,
    sf.status,
    sf.tenant_id
FROM public.student_fees sf
JOIN public.students s ON sf.student_id = s.id
WHERE s.name ILIKE '%justus%'
ORDER BY sf.fee_component;

-- 3. Check available fee structure data for Justus's tenant and class
SELECT 
    'FEE STRUCTURE FOR JUSTUS CLASS' as section,
    fs.id,
    fs.fee_component,
    fs.amount,
    fs.base_amount,
    fs.discount_applied,
    fs.academic_year,
    fs.class_id,
    fs.student_id,
    fs.tenant_id,
    c.class_name,
    c.section
FROM public.fee_structure fs
LEFT JOIN public.classes c ON fs.class_id = c.id
WHERE fs.tenant_id IN (
    SELECT s.tenant_id 
    FROM public.students s 
    WHERE s.name ILIKE '%justus%'
)
AND fs.class_id IN (
    SELECT s.class_id 
    FROM public.students s 
    WHERE s.name ILIKE '%justus%'
)
ORDER BY fs.fee_component, fs.academic_year;

-- 4. Check if there are any fee structures with bus-related components
SELECT 
    'BUS FEE STRUCTURES' as section,
    fs.fee_component,
    fs.amount,
    fs.discount_applied,
    fs.academic_year,
    fs.tenant_id,
    c.class_name
FROM public.fee_structure fs
LEFT JOIN public.classes c ON fs.class_id = c.id
WHERE fs.fee_component ILIKE '%bus%'
   OR fs.fee_component ILIKE '%transport%'
ORDER BY fs.fee_component;

-- 5. Check student discounts for Justus
SELECT 
    'JUSTUS STUDENT DISCOUNTS' as section,
    sd.id,
    sd.fee_component,
    sd.discount_type,
    sd.discount_value,
    sd.academic_year,
    sd.is_active,
    sd.created_at,
    sd.updated_at
FROM public.student_discounts sd
JOIN public.students s ON sd.student_id = s.id
WHERE s.name ILIKE '%justus%'
ORDER BY sd.fee_component, sd.updated_at DESC;

-- 6. Check academic year formats across tables
SELECT 
    'ACADEMIC YEAR FORMATS' as section,
    'students' as table_name,
    academic_year,
    COUNT(*) as count
FROM public.students 
GROUP BY academic_year
UNION ALL
SELECT 
    'ACADEMIC YEAR FORMATS' as section,
    'fee_structure' as table_name,
    academic_year,
    COUNT(*) as count
FROM public.fee_structure 
GROUP BY academic_year
UNION ALL
SELECT 
    'ACADEMIC YEAR FORMATS' as section,
    'student_fees' as table_name,
    academic_year,
    COUNT(*) as count
FROM public.student_fees 
GROUP BY academic_year
ORDER BY table_name, academic_year;

-- 7. Check exact fee component names
SELECT 
    'FEE COMPONENT NAMES' as section,
    'fee_structure' as source,
    DISTINCT fee_component,
    COUNT(*) as count
FROM public.fee_structure
GROUP BY fee_component
UNION ALL
SELECT 
    'FEE COMPONENT NAMES' as section,
    'student_fees' as source,
    DISTINCT fee_component,
    COUNT(*) as count
FROM public.student_fees
GROUP BY fee_component
ORDER BY source, fee_component;

-- 8. Summary of potential issues
SELECT 
    'POTENTIAL ISSUES SUMMARY' as section,
    CASE 
        WHEN (SELECT COUNT(*) FROM public.students WHERE name ILIKE '%justus%') = 0 
        THEN 'No Justus found in students table'
        WHEN (SELECT COUNT(*) FROM public.fee_structure WHERE fee_component ILIKE '%bus%') = 0
        THEN 'No bus fee in fee_structure table'
        WHEN (SELECT COUNT(DISTINCT academic_year) FROM public.fee_structure) > 1
             AND (SELECT COUNT(DISTINCT academic_year) FROM public.student_fees) > 1
             AND NOT EXISTS (
                 SELECT 1 FROM public.fee_structure fs 
                 JOIN public.student_fees sf ON fs.academic_year = sf.academic_year
             )
        THEN 'Academic year mismatch between fee_structure and student_fees'
        ELSE 'Data looks consistent'
    END as diagnosis;
