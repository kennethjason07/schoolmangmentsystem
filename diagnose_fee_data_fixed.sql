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

-- 3. Check fee structure data for Justus's tenant and class
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
WHERE fs.tenant_id = (
    SELECT s.tenant_id 
    FROM public.students s 
    WHERE s.name ILIKE '%justus%'
    LIMIT 1
)
AND fs.class_id = (
    SELECT s.class_id 
    FROM public.students s 
    WHERE s.name ILIKE '%justus%'
    LIMIT 1
)
ORDER BY fs.fee_component, fs.academic_year;

-- 4. Check bus fee structures
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

-- 6. Check academic year formats
SELECT 
    'STUDENTS ACADEMIC YEARS' as section,
    academic_year,
    COUNT(*) as count
FROM public.students 
GROUP BY academic_year
ORDER BY academic_year;

SELECT 
    'FEE STRUCTURE ACADEMIC YEARS' as section,
    academic_year,
    COUNT(*) as count
FROM public.fee_structure 
GROUP BY academic_year
ORDER BY academic_year;

SELECT 
    'STUDENT FEES ACADEMIC YEARS' as section,
    academic_year,
    COUNT(*) as count
FROM public.student_fees 
GROUP BY academic_year
ORDER BY academic_year;

-- 7. Check fee component names
SELECT 
    'FEE STRUCTURE COMPONENTS' as section,
    fee_component,
    COUNT(*) as count
FROM public.fee_structure
GROUP BY fee_component
ORDER BY fee_component;

SELECT 
    'STUDENT FEES COMPONENTS' as section,
    fee_component,
    COUNT(*) as count
FROM public.student_fees
GROUP BY fee_component
ORDER BY fee_component;

-- 8. Test the specific query that should work for Justus Bus fee
SELECT 
    'JUSTUS BUS FEE LOOKUP TEST' as section,
    s.name as student_name,
    s.class_id,
    s.academic_year as student_academic_year,
    s.tenant_id,
    sf.fee_component as payment_component,
    sf.academic_year as payment_academic_year,
    fs.fee_component as structure_component,
    fs.academic_year as structure_academic_year,
    fs.amount as base_fee,
    fs.discount_applied as base_discount
FROM public.students s
JOIN public.student_fees sf ON s.id = sf.student_id
LEFT JOIN public.fee_structure fs ON (
    fs.tenant_id = sf.tenant_id 
    AND fs.fee_component = sf.fee_component 
    AND fs.academic_year = sf.academic_year 
    AND fs.class_id = s.class_id 
    AND fs.student_id IS NULL
)
WHERE s.name ILIKE '%justus%' 
AND sf.fee_component ILIKE '%bus%';
