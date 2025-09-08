-- Optional PostgreSQL RPC Function for Ultra-Fast Fee Data Retrieval
-- This function can provide even better performance than the optimized batch queries
-- Run this in your PostgreSQL database for maximum performance

CREATE OR REPLACE FUNCTION get_comprehensive_fee_data(
    p_tenant_id uuid,
    p_academic_year text DEFAULT '2024-25'
)
RETURNS TABLE(
    data_type text,
    class_id uuid,
    class_name text,
    section text,
    student_id uuid,
    student_name text,
    fee_id uuid,
    fee_component text,
    fee_amount numeric,
    fee_base_amount numeric,
    fee_due_date date,
    payment_id uuid,
    amount_paid numeric,
    payment_date date,
    discount_id uuid,
    discount_type text,
    discount_value numeric
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH class_data AS (
        SELECT 
            'class' as data_type,
            c.id as class_id,
            c.class_name,
            c.section,
            NULL::uuid as student_id,
            NULL::text as student_name,
            NULL::uuid as fee_id,
            NULL::text as fee_component,
            NULL::numeric as fee_amount,
            NULL::numeric as fee_base_amount,
            NULL::date as fee_due_date,
            NULL::uuid as payment_id,
            NULL::numeric as amount_paid,
            NULL::date as payment_date,
            NULL::uuid as discount_id,
            NULL::text as discount_type,
            NULL::numeric as discount_value
        FROM public.classes c
        WHERE c.tenant_id = p_tenant_id 
        AND c.academic_year = p_academic_year
    ),
    student_data AS (
        SELECT 
            'student' as data_type,
            s.class_id,
            NULL::text as class_name,
            NULL::text as section,
            s.id as student_id,
            s.name as student_name,
            NULL::uuid as fee_id,
            NULL::text as fee_component,
            NULL::numeric as fee_amount,
            NULL::numeric as fee_base_amount,
            NULL::date as fee_due_date,
            NULL::uuid as payment_id,
            NULL::numeric as amount_paid,
            NULL::date as payment_date,
            NULL::uuid as discount_id,
            NULL::text as discount_type,
            NULL::numeric as discount_value
        FROM public.students s
        WHERE s.tenant_id = p_tenant_id 
        AND s.academic_year = p_academic_year
    ),
    fee_structure_data AS (
        SELECT 
            'fee_structure' as data_type,
            fs.class_id,
            NULL::text as class_name,
            NULL::text as section,
            fs.student_id,
            NULL::text as student_name,
            fs.id as fee_id,
            fs.fee_component,
            fs.amount as fee_amount,
            fs.base_amount as fee_base_amount,
            fs.due_date as fee_due_date,
            NULL::uuid as payment_id,
            NULL::numeric as amount_paid,
            NULL::date as payment_date,
            NULL::uuid as discount_id,
            NULL::text as discount_type,
            NULL::numeric as discount_value
        FROM public.fee_structure fs
        WHERE fs.tenant_id = p_tenant_id 
        AND fs.academic_year = p_academic_year
    ),
    payment_data AS (
        SELECT 
            'payment' as data_type,
            NULL::uuid as class_id,
            NULL::text as class_name,
            NULL::text as section,
            sf.student_id,
            NULL::text as student_name,
            NULL::uuid as fee_id,
            sf.fee_component,
            NULL::numeric as fee_amount,
            NULL::numeric as fee_base_amount,
            NULL::date as fee_due_date,
            sf.id as payment_id,
            sf.amount_paid,
            sf.payment_date,
            NULL::uuid as discount_id,
            NULL::text as discount_type,
            NULL::numeric as discount_value
        FROM public.student_fees sf
        WHERE sf.tenant_id = p_tenant_id 
        AND sf.academic_year = p_academic_year
        ORDER BY sf.payment_date DESC
    ),
    discount_data AS (
        SELECT 
            'discount' as data_type,
            sd.class_id,
            NULL::text as class_name,
            NULL::text as section,
            sd.student_id,
            NULL::text as student_name,
            NULL::uuid as fee_id,
            sd.fee_component,
            NULL::numeric as fee_amount,
            NULL::numeric as fee_base_amount,
            NULL::date as fee_due_date,
            NULL::uuid as payment_id,
            NULL::numeric as amount_paid,
            NULL::date as payment_date,
            sd.id as discount_id,
            sd.discount_type,
            sd.discount_value
        FROM public.student_discounts sd
        WHERE sd.tenant_id = p_tenant_id 
        AND sd.academic_year = p_academic_year
        AND sd.is_active = true
    )
    
    -- Combine all data types
    SELECT * FROM class_data
    UNION ALL
    SELECT * FROM student_data  
    UNION ALL
    SELECT * FROM fee_structure_data
    UNION ALL
    SELECT * FROM payment_data
    UNION ALL
    SELECT * FROM discount_data;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_comprehensive_fee_data(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_comprehensive_fee_data(uuid, text) TO service_role;

-- Example usage:
-- SELECT * FROM get_comprehensive_fee_data('your-tenant-id'::uuid, '2024-25');

-- Performance test query:
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM get_comprehensive_fee_data('your-tenant-id'::uuid, '2024-25');

-- To drop the function if needed:
-- DROP FUNCTION IF EXISTS get_comprehensive_fee_data(uuid, text);
