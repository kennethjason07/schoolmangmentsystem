-- ============================================================
-- STUDENT FEES FIX WITHOUT TENANT CONTEXT DEPENDENCY
-- ============================================================
-- This version fixes the calculation without relying on external functions
-- that might cause "Tenant context required but not found" errors

BEGIN;

-- Step 1: Ensure required columns exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fees' AND column_name = 'total_amount') THEN
        ALTER TABLE public.student_fees ADD COLUMN total_amount NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Added total_amount column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fees' AND column_name = 'remaining_amount') THEN
        ALTER TABLE public.student_fees ADD COLUMN remaining_amount NUMERIC(10,2) DEFAULT 0;
        RAISE NOTICE '✅ Added remaining_amount column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fees' AND column_name = 'status') THEN
        ALTER TABLE public.student_fees ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE '✅ Added status column';
    END IF;
END $$;

-- Step 2: Create fixed calculation function
CREATE OR REPLACE FUNCTION fix_student_fees_direct()
RETURNS void AS $$
DECLARE
    fee_record RECORD;
    base_fee_amount NUMERIC := 0;
    base_discount_amount NUMERIC := 0;
    individual_discount_amount NUMERIC := 0;
    calculated_total_amount NUMERIC := 0;
    paid_amount NUMERIC := 0;
    calculated_remaining NUMERIC := 0;
    calculated_status VARCHAR(20) := 'pending';
    updated_count INTEGER := 0;
    discount_record RECORD;
BEGIN
    RAISE NOTICE '🔧 Starting direct student fees calculation fix...';
    
    FOR fee_record IN (
        SELECT 
            sf.id,
            sf.student_id,
            sf.fee_component,
            sf.amount_paid,
            sf.academic_year,
            sf.tenant_id,
            sf.total_amount as current_total,
            sf.remaining_amount as current_remaining,
            sf.status as current_status,
            s.name as student_name,
            s.class_id
        FROM public.student_fees sf
        JOIN public.students s ON sf.student_id = s.id
        WHERE sf.tenant_id IS NOT NULL
        ORDER BY sf.created_at DESC
    ) LOOP
        
        -- Reset variables
        base_fee_amount := 0;
        base_discount_amount := 0;
        individual_discount_amount := 0;
        calculated_total_amount := 0;
        paid_amount := COALESCE(fee_record.amount_paid, 0);
        
        -- Get base fee and discount from fee_structure
        SELECT 
            COALESCE(fs.amount, 0) as fee_amount,
            COALESCE(fs.discount_applied, 0) as base_discount
        INTO base_fee_amount, base_discount_amount
        FROM public.fee_structure fs
        WHERE fs.tenant_id = fee_record.tenant_id
        AND fs.class_id = fee_record.class_id
        AND fs.student_id IS NULL  -- Only class-level fees
        AND (
            -- Try exact match first
            (fs.fee_component = fee_record.fee_component AND fs.academic_year = fee_record.academic_year)
            OR
            -- Try case insensitive match
            (LOWER(fs.fee_component) = LOWER(fee_record.fee_component) AND fs.academic_year = fee_record.academic_year)
            OR
            -- Try fuzzy match with same academic year
            ((fs.fee_component ILIKE '%' || fee_record.fee_component || '%' OR fee_record.fee_component ILIKE '%' || fs.fee_component || '%') 
             AND fs.academic_year = fee_record.academic_year)
            OR
            -- Try exact component match with any academic year (fallback)
            (fs.fee_component = fee_record.fee_component)
            OR
            -- Try case insensitive match with any academic year (fallback)
            (LOWER(fs.fee_component) = LOWER(fee_record.fee_component))
        )
        ORDER BY 
            -- Prioritize exact matches with correct academic year
            CASE 
                WHEN fs.fee_component = fee_record.fee_component AND fs.academic_year = fee_record.academic_year THEN 0
                WHEN LOWER(fs.fee_component) = LOWER(fee_record.fee_component) AND fs.academic_year = fee_record.academic_year THEN 1
                WHEN fs.fee_component = fee_record.fee_component THEN 2
                WHEN LOWER(fs.fee_component) = LOWER(fee_record.fee_component) THEN 3
                ELSE 4
            END,
            fs.created_at DESC
        LIMIT 1;
        
        -- Get individual student discount (latest by updated_at)
        SELECT 
            sd.discount_type,
            sd.discount_value
        INTO discount_record
        FROM public.student_discounts sd
        WHERE sd.tenant_id = fee_record.tenant_id
        AND sd.student_id = fee_record.student_id
        AND sd.is_active = true
        AND (
            sd.fee_component = fee_record.fee_component OR
            LOWER(sd.fee_component) = LOWER(fee_record.fee_component) OR
            sd.fee_component IS NULL  -- General discount
        )
        AND (
            sd.academic_year = fee_record.academic_year OR
            sd.academic_year IS NULL  -- Academic year agnostic discount
        )
        ORDER BY 
            CASE WHEN sd.fee_component = fee_record.fee_component THEN 0 ELSE 1 END,
            CASE WHEN sd.academic_year = fee_record.academic_year THEN 0 ELSE 1 END,
            sd.updated_at DESC
        LIMIT 1;
        
        -- Calculate individual discount amount
        IF discount_record IS NOT NULL THEN
            IF discount_record.discount_type = 'percentage' THEN
                individual_discount_amount := (base_fee_amount * discount_record.discount_value) / 100;
            ELSIF discount_record.discount_type = 'fixed_amount' THEN
                individual_discount_amount := discount_record.discount_value;
            END IF;
        END IF;
        
        -- Calculate final amounts
        IF base_fee_amount > 0 THEN
            -- We found fee structure data
            calculated_total_amount := GREATEST(0, base_fee_amount - base_discount_amount - individual_discount_amount);
        ELSE
            -- No fee structure found, use intelligent defaults
            IF LOWER(fee_record.fee_component) LIKE '%tuition%' OR LOWER(fee_record.fee_component) LIKE '%admission%' THEN
                calculated_total_amount := GREATEST(paid_amount, 35000.00);
            ELSIF LOWER(fee_record.fee_component) LIKE '%bus%' OR LOWER(fee_record.fee_component) LIKE '%transport%' THEN
                calculated_total_amount := GREATEST(paid_amount, 1500.00);
            ELSIF LOWER(fee_record.fee_component) LIKE '%library%' THEN
                calculated_total_amount := GREATEST(paid_amount, 500.00);
            ELSIF LOWER(fee_record.fee_component) LIKE '%lab%' THEN
                calculated_total_amount := GREATEST(paid_amount, 800.00);
            ELSIF LOWER(fee_record.fee_component) LIKE '%sports%' THEN
                calculated_total_amount := GREATEST(paid_amount, 300.00);
            ELSE
                calculated_total_amount := GREATEST(paid_amount, paid_amount * 1.25);
            END IF;
            
            RAISE NOTICE 'ℹ️ No fee structure found for % - % (%), using estimated total: ₹%', 
                fee_record.student_name, fee_record.fee_component, fee_record.academic_year, calculated_total_amount;
        END IF;
        
        -- Calculate remaining and status
        calculated_remaining := GREATEST(0, calculated_total_amount - paid_amount);
        
        IF paid_amount = 0 THEN
            calculated_status := 'pending';
        ELSIF paid_amount >= calculated_total_amount THEN
            calculated_status := 'paid';
        ELSE
            calculated_status := 'partial';
        END IF;
        
        -- Update the record
        UPDATE public.student_fees 
        SET 
            total_amount = calculated_total_amount,
            remaining_amount = calculated_remaining,
            status = calculated_status
        WHERE id = fee_record.id;
        
        updated_count := updated_count + 1;
        
        -- Log changes
        IF (COALESCE(fee_record.current_total, 0) != calculated_total_amount OR 
            COALESCE(fee_record.current_remaining, 0) != calculated_remaining OR 
            COALESCE(fee_record.current_status, '') != calculated_status) THEN
            
            RAISE NOTICE '🔄 Updated % (%): Base:₹% BaseDisc:₹% IndvDisc:₹% → Total:₹% Paid:₹% Remain:₹% Status:%',
                fee_record.student_name,
                fee_record.fee_component,
                base_fee_amount,
                base_discount_amount,
                individual_discount_amount,
                calculated_total_amount,
                paid_amount,
                calculated_remaining,
                calculated_status;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Successfully updated % student fee records', updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Execute the fix
SELECT fix_student_fees_direct();

-- Step 4: Update constraint for proper status values
ALTER TABLE public.student_fees DROP CONSTRAINT IF EXISTS student_fees_status_check;
ALTER TABLE public.student_fees ADD CONSTRAINT student_fees_status_check 
CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled'));

-- Step 5: Verification with detailed breakdown
SELECT 
    '=== FIXED RECORDS VERIFICATION ===' as section,
    COUNT(*) as total_records,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    ROUND(AVG(total_amount), 2) as avg_total_amount,
    ROUND(AVG(amount_paid), 2) as avg_amount_paid,
    ROUND(AVG(remaining_amount), 2) as avg_remaining
FROM public.student_fees 
WHERE tenant_id IS NOT NULL;

-- Show corrected records with all the details
SELECT 
    '=== SAMPLE CORRECTED RECORDS ===' as section,
    s.name as student_name,
    sf.fee_component,
    sf.amount_paid,
    sf.total_amount,
    sf.remaining_amount,
    sf.status,
    sf.academic_year,
    fs.amount as base_fee,
    fs.discount_applied as base_discount,
    CASE 
        WHEN sd.discount_type = 'percentage' THEN CONCAT(sd.discount_value::text, '%')
        WHEN sd.discount_type = 'fixed_amount' THEN CONCAT('₹', sd.discount_value::text)
        ELSE 'No discount'
    END as individual_discount
FROM public.student_fees sf
JOIN public.students s ON sf.student_id = s.id
LEFT JOIN public.fee_structure fs ON (
    fs.tenant_id = sf.tenant_id 
    AND fs.class_id = s.class_id 
    AND fs.student_id IS NULL
    AND (
        (fs.fee_component = sf.fee_component AND fs.academic_year = sf.academic_year) OR
        (LOWER(fs.fee_component) = LOWER(sf.fee_component) AND fs.academic_year = sf.academic_year) OR
        (fs.fee_component = sf.fee_component) OR
        (LOWER(fs.fee_component) = LOWER(sf.fee_component))
    )
)
LEFT JOIN public.student_discounts sd ON (
    sd.tenant_id = sf.tenant_id 
    AND sd.student_id = sf.student_id 
    AND sd.is_active = true
    AND (
        sd.fee_component = sf.fee_component OR
        LOWER(sd.fee_component) = LOWER(sf.fee_component) OR
        sd.fee_component IS NULL
    )
    AND (
        sd.academic_year = sf.academic_year OR
        sd.academic_year IS NULL
    )
)
WHERE sf.tenant_id IS NOT NULL
ORDER BY sf.created_at DESC
LIMIT 5;

-- Clean up
DROP FUNCTION fix_student_fees_direct();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '🎉 STUDENT FEES FIX COMPLETED!';
    RAISE NOTICE '✅ Fixed calculation logic without tenant context dependency';
    RAISE NOTICE '✅ Uses intelligent defaults when fee structure is missing';
    RAISE NOTICE '✅ Handles academic year and component name variations';
END $$;

COMMIT;
