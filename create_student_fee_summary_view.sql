-- ============================================================
-- CREATE STUDENT_FEE_SUMMARY VIEW FOR EMAIL-BASED TENANT SYSTEM
-- ============================================================
-- This view will be used by the student fee payment screen
-- Following the email-based tenant system from EMAIL_BASED_TENANT_SYSTEM.md

CREATE OR REPLACE VIEW public.student_fee_summary AS
WITH student_class_fees AS (
    -- Get all students with their class-level fees
    SELECT 
        s.id as student_id,
        s.name as student_name,
        s.admission_no,
        s.roll_no,
        s.class_id,
        s.academic_year,
        s.tenant_id,
        c.class_name,
        c.section,
        
        -- Fee structure for this student's class
        fs.id as fee_structure_id,
        fs.fee_component,
        fs.amount as base_amount,
        fs.due_date,
        fs.academic_year as fee_academic_year
        
    FROM public.students s
    LEFT JOIN public.classes c ON s.class_id = c.id
    LEFT JOIN public.fee_structure fs ON fs.class_id = s.class_id 
        AND fs.tenant_id = s.tenant_id
        AND fs.student_id IS NULL  -- Only class-level fees
        AND (fs.academic_year = s.academic_year OR fs.academic_year = '2024-2025')
),
student_discounts AS (
    -- Get individual student discounts
    SELECT 
        scf.student_id,
        scf.fee_component,
        COALESCE(
            CASE sd.discount_type
                WHEN 'percentage' THEN scf.base_amount * (sd.discount_value / 100.0)
                WHEN 'fixed_amount' THEN sd.discount_value
                ELSE 0
            END, 0
        ) as discount_amount,
        sd.discount_type,
        sd.discount_value,
        sd.description as discount_reason
    FROM student_class_fees scf
    LEFT JOIN public.student_discounts sd ON sd.student_id = scf.student_id 
        AND (sd.fee_component = scf.fee_component OR sd.fee_component IS NULL)
        AND sd.is_active = true
        AND sd.tenant_id = scf.tenant_id
),
student_payments AS (
    -- Get payments made by students
    SELECT 
        scf.student_id,
        scf.fee_component,
        COALESCE(SUM(sf.amount_paid), 0) as total_paid,
        COUNT(sf.id) as payment_count,
        MAX(sf.payment_date) as last_payment_date
    FROM student_class_fees scf
    LEFT JOIN public.student_fees sf ON sf.student_id = scf.student_id 
        AND sf.fee_component = scf.fee_component
        AND sf.tenant_id = scf.tenant_id
    GROUP BY scf.student_id, scf.fee_component
)
SELECT 
    scf.student_id,
    scf.student_name,
    scf.admission_no,
    scf.roll_no,
    scf.class_name,
    scf.section,
    scf.academic_year,
    scf.tenant_id,
    
    -- Aggregated totals for the student
    COALESCE(SUM(scf.base_amount), 0) as total_base_fees,
    COALESCE(SUM(sd.discount_amount), 0) as total_discounts,
    COALESCE(SUM(scf.base_amount - COALESCE(sd.discount_amount, 0)), 0) as total_final_fees,
    COALESCE(SUM(sp.total_paid), 0) as total_paid,
    COALESCE(SUM(scf.base_amount - COALESCE(sd.discount_amount, 0) - COALESCE(sp.total_paid, 0)), 0) as total_outstanding,
    
    -- Fee component details (as JSON for easy consumption)
    json_agg(
        json_build_object(
            'fee_component', scf.fee_component,
            'base_amount', scf.base_amount,
            'discount_amount', COALESCE(sd.discount_amount, 0),
            'final_amount', scf.base_amount - COALESCE(sd.discount_amount, 0),
            'paid_amount', COALESCE(sp.total_paid, 0),
            'outstanding_amount', scf.base_amount - COALESCE(sd.discount_amount, 0) - COALESCE(sp.total_paid, 0),
            'due_date', scf.due_date,
            'status', CASE 
                WHEN COALESCE(sp.total_paid, 0) >= (scf.base_amount - COALESCE(sd.discount_amount, 0)) THEN 'paid'
                WHEN COALESCE(sp.total_paid, 0) > 0 THEN 'partial'
                ELSE 'unpaid'
            END,
            'has_discount', CASE WHEN COALESCE(sd.discount_amount, 0) > 0 THEN true ELSE false END,
            'discount_type', sd.discount_type,
            'discount_value', sd.discount_value,
            'payment_count', COALESCE(sp.payment_count, 0),
            'last_payment_date', sp.last_payment_date
        )
    ) FILTER (WHERE scf.fee_component IS NOT NULL) as fee_components,
    
    -- Overall status
    CASE 
        WHEN COALESCE(SUM(scf.base_amount - COALESCE(sd.discount_amount, 0) - COALESCE(sp.total_paid, 0)), 0) = 0 THEN 'fully_paid'
        WHEN COALESCE(SUM(sp.total_paid), 0) > 0 THEN 'partially_paid'
        ELSE 'unpaid'
    END as overall_status,
    
    -- Summary flags
    CASE WHEN COALESCE(SUM(sd.discount_amount), 0) > 0 THEN true ELSE false END as has_any_discounts,
    COUNT(scf.fee_component) as total_fee_components,
    
    -- Calculated timestamp
    NOW() as calculated_at

FROM student_class_fees scf
LEFT JOIN student_discounts sd ON sd.student_id = scf.student_id AND sd.fee_component = scf.fee_component
LEFT JOIN student_payments sp ON sp.student_id = scf.student_id AND sp.fee_component = scf.fee_component
WHERE scf.student_id IS NOT NULL  -- Only include students with data
GROUP BY scf.student_id, scf.student_name, scf.admission_no, scf.roll_no, scf.class_name, scf.section, scf.academic_year, scf.tenant_id
ORDER BY scf.student_name;

-- Grant access to the view
GRANT SELECT ON public.student_fee_summary TO authenticated, anon;

-- Verify the view was created
SELECT 
    'VIEW CREATED SUCCESSFULLY' as status,
    COUNT(*) as student_count
FROM public.student_fee_summary;

-- Show sample data
SELECT 
    'SAMPLE DATA' as type,
    student_name,
    total_base_fees,
    total_paid,
    total_outstanding,
    overall_status
FROM public.student_fee_summary 
LIMIT 3;
