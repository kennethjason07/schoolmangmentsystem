-- ========================================
-- COMPREHENSIVE STUDENT FEES WITH DISCOUNTS VIEW
-- ========================================
-- This view provides a complete picture of student fees including:
-- 1. Base fees from fee_structure (class-level fees)
-- 2. Applied discounts from student_discounts
-- 3. Calculated final fees after discounts
-- 4. Payment history from student_fees
-- 5. Outstanding amounts

-- Create the comprehensive view
CREATE OR REPLACE VIEW student_fees_with_discounts AS
WITH base_fees AS (
    -- Get base fees for each student from their class fee structure
    SELECT 
        s.id as student_id,
        s.name as student_name,
        s.admission_no,
        s.roll_no,
        s.class_id,
        c.class_name,
        c.section,
        s.academic_year,
        s.tenant_id,
        
        -- Base fee information
        fs.id as fee_structure_id,
        fs.fee_component,
        fs.amount as base_amount,
        fs.due_date,
        COALESCE(fs.discount_applied, 0) as system_discount_applied
        
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN fee_structure fs ON fs.class_id = s.class_id 
        AND fs.academic_year = s.academic_year
        AND fs.student_id IS NULL  -- Only class-level fees
    WHERE s.tenant_id = fs.tenant_id
),

student_discounts_summary AS (
    -- Get individual student discounts
    SELECT 
        sd.student_id,
        sd.fee_component,
        sd.discount_type,
        sd.discount_value,
        sd.description as discount_reason,
        sd.is_active,
        
        -- Calculate discount amount based on type
        CASE 
            WHEN sd.fee_component IS NOT NULL THEN
                -- Component-specific discount
                CASE sd.discount_type
                    WHEN 'percentage' THEN 
                        (SELECT bf.base_amount * (sd.discount_value / 100.0) 
                         FROM base_fees bf 
                         WHERE bf.student_id = sd.student_id 
                         AND bf.fee_component = sd.fee_component)
                    WHEN 'fixed_amount' THEN sd.discount_value
                    ELSE 0
                END
            ELSE
                -- General discount (applies to all components)
                CASE sd.discount_type
                    WHEN 'percentage' THEN 
                        (SELECT SUM(bf.base_amount * (sd.discount_value / 100.0))
                         FROM base_fees bf 
                         WHERE bf.student_id = sd.student_id)
                    WHEN 'fixed_amount' THEN sd.discount_value
                    ELSE 0
                END
        END as calculated_discount_amount
        
    FROM student_discounts sd
    WHERE sd.is_active = true
),

payment_summary AS (
    -- Get payment summary per student per component
    SELECT 
        sf.student_id,
        sf.fee_component,
        SUM(sf.amount_paid) as total_paid,
        COUNT(*) as payment_count,
        MAX(sf.payment_date) as last_payment_date,
        string_agg(sf.receipt_number::text, ', ') as receipt_numbers
    FROM student_fees sf
    GROUP BY sf.student_id, sf.fee_component
)

-- Main query combining all data
SELECT 
    bf.student_id,
    bf.student_name,
    bf.admission_no,
    bf.roll_no,
    bf.class_id,
    bf.class_name,
    bf.section,
    bf.academic_year,
    bf.tenant_id,
    
    -- Fee component details
    bf.fee_component,
    bf.base_amount,
    bf.due_date,
    
    -- Discount information
    COALESCE(sds.discount_type, 'none') as discount_type,
    COALESCE(sds.discount_value, 0) as discount_value,
    COALESCE(sds.calculated_discount_amount, 0) as discount_amount,
    COALESCE(sds.discount_reason, 'No discount applied') as discount_reason,
    
    -- Calculated amounts
    bf.base_amount - COALESCE(sds.calculated_discount_amount, 0) as final_amount,
    COALESCE(ps.total_paid, 0) as amount_paid,
    GREATEST(0, (bf.base_amount - COALESCE(sds.calculated_discount_amount, 0)) - COALESCE(ps.total_paid, 0)) as outstanding_amount,
    
    -- Payment information
    COALESCE(ps.payment_count, 0) as payment_count,
    ps.last_payment_date,
    ps.receipt_numbers,
    
    -- Status calculations
    CASE 
        WHEN COALESCE(ps.total_paid, 0) >= (bf.base_amount - COALESCE(sds.calculated_discount_amount, 0)) THEN 'paid'
        WHEN COALESCE(ps.total_paid, 0) > 0 THEN 'partial'
        ELSE 'unpaid'
    END as payment_status,
    
    -- Summary flags
    CASE WHEN COALESCE(sds.calculated_discount_amount, 0) > 0 THEN true ELSE false END as has_discount,
    CASE WHEN COALESCE(ps.total_paid, 0) > 0 THEN true ELSE false END as has_payments,
    
    -- Calculated at timestamp
    NOW() as calculated_at

FROM base_fees bf
LEFT JOIN student_discounts_summary sds ON bf.student_id = sds.student_id 
    AND (sds.fee_component = bf.fee_component OR sds.fee_component IS NULL)
LEFT JOIN payment_summary ps ON bf.student_id = ps.student_id 
    AND bf.fee_component = ps.fee_component

ORDER BY bf.student_name, bf.fee_component;

-- ========================================
-- STUDENT FEE SUMMARY VIEW (For Dashboards)
-- ========================================
CREATE OR REPLACE VIEW student_fee_summary AS
SELECT 
    student_id,
    student_name,
    admission_no,
    roll_no,
    class_name,
    section,
    academic_year,
    tenant_id,
    
    -- Totals
    SUM(base_amount) as total_base_fees,
    SUM(discount_amount) as total_discounts,
    SUM(final_amount) as total_final_fees,
    SUM(amount_paid) as total_paid,
    SUM(outstanding_amount) as total_outstanding,
    
    -- Counts
    COUNT(*) as total_fee_components,
    SUM(CASE WHEN has_discount THEN 1 ELSE 0 END) as discounted_components,
    SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_components,
    SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_components,
    SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_components,
    
    -- Overall status
    CASE 
        WHEN SUM(outstanding_amount) = 0 THEN 'fully_paid'
        WHEN SUM(amount_paid) > 0 THEN 'partially_paid'
        ELSE 'unpaid'
    END as overall_status,
    
    -- Discount summary
    CASE WHEN SUM(discount_amount) > 0 THEN true ELSE false END as has_any_discounts,
    
    -- Payment summary
    MAX(last_payment_date) as last_payment_date,
    
    -- Calculated at
    NOW() as summary_calculated_at

FROM student_fees_with_discounts
GROUP BY student_id, student_name, admission_no, roll_no, class_name, section, academic_year, tenant_id
ORDER BY student_name;

-- ========================================
-- SAMPLE QUERIES TO TEST THE VIEW
-- ========================================

-- 1. Get all fee details for a specific student
/*
SELECT * FROM student_fees_with_discounts 
WHERE student_id = 'your-student-id-here'
ORDER BY fee_component;
*/

-- 2. Get fee summary for all students
/*
SELECT 
    student_name,
    total_base_fees,
    total_discounts,
    total_final_fees,
    total_paid,
    total_outstanding,
    overall_status,
    has_any_discounts
FROM student_fee_summary 
ORDER BY total_outstanding DESC;
*/

-- 3. Get students with discounts applied
/*
SELECT 
    student_name,
    fee_component,
    base_amount,
    discount_amount,
    final_amount,
    discount_reason
FROM student_fees_with_discounts
WHERE has_discount = true
ORDER BY student_name, fee_component;
*/

-- 4. Get payment status summary
/*
SELECT 
    overall_status,
    COUNT(*) as student_count,
    SUM(total_final_fees) as total_fees,
    SUM(total_paid) as total_collected,
    SUM(total_outstanding) as total_pending
FROM student_fee_summary
GROUP BY overall_status;
*/

-- ========================================
-- GRANT PERMISSIONS (Run as needed)
-- ========================================
-- GRANT SELECT ON student_fees_with_discounts TO authenticated;
-- GRANT SELECT ON student_fee_summary TO authenticated;
