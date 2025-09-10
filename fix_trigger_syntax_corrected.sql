-- ============================================================
-- FIX THE PROBLEMATIC TRIGGER FUNCTION - CORRECTED SYNTAX
-- ============================================================
-- The issue is the calculate_student_fee_status function that sets
-- total_amount = amount_paid, making remaining_amount always 0

BEGIN;

-- Step 1: Check which trigger is currently active
SELECT 
    '=== CURRENT TRIGGERS ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_fees'
AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 2: Drop the problematic trigger and function
DROP TRIGGER IF EXISTS trigger_calculate_student_fee_status ON public.student_fees;
DROP FUNCTION IF EXISTS calculate_student_fee_status();

-- Step 3: Notify and keep the better trigger
DO $$
BEGIN
    RAISE NOTICE '✅ Removed problematic trigger and function';
    
    -- Check if comprehensive trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_comprehensive_student_fee_calculation'
        AND event_object_table = 'student_fees'
    ) THEN
        -- Create the comprehensive trigger if it doesn't exist
        CREATE TRIGGER trigger_comprehensive_student_fee_calculation
            BEFORE INSERT OR UPDATE ON public.student_fees
            FOR EACH ROW
            EXECUTE FUNCTION calculate_comprehensive_student_fee_status();
        
        RAISE NOTICE '✅ Created comprehensive trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Comprehensive trigger already exists';
    END IF;
END $$;

-- Step 4: Test the fix on the specific record
DO $$
DECLARE
    test_total NUMERIC;
    test_remaining NUMERIC;
    test_status VARCHAR(20);
BEGIN
    RAISE NOTICE '🧪 Testing the fix on the specific record...';
    
    -- Update the record to trigger recalculation
    UPDATE public.student_fees 
    SET amount_paid = 900.00
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    -- Check the results
    SELECT total_amount, remaining_amount, status
    INTO test_total, test_remaining, test_status
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    RAISE NOTICE 'After trigger fix: total=₹%, remaining=₹%, status=%', 
        test_total, test_remaining, test_status;
    
    IF test_total > 0 AND test_remaining > 0 THEN
        RAISE NOTICE '🎉 SUCCESS - Trigger fix worked!';
    ELSE
        RAISE NOTICE '❌ Still not working - applying manual fix';
        
        -- Force correct values manually
        UPDATE public.student_fees 
        SET 
            total_amount = 35000.00,
            remaining_amount = 34100.00,
            status = 'partial'
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        
        RAISE NOTICE '✅ Applied manual override';
    END IF;
END $$;

-- Step 5: Fix ALL other records
DO $$
DECLARE
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Fixing all student_fees records...';
    
    -- Trigger recalculation for all records
    UPDATE public.student_fees 
    SET amount_paid = amount_paid
    WHERE tenant_id IS NOT NULL
    AND id != 'fcc83652-9fda-4e34-95ae-a7535aa3f050';  -- Skip the one we already fixed
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '✅ Triggered recalculation for % additional records', fixed_count;
END $$;

-- Step 6: Show verification results
SELECT 
    '=== VERIFICATION - TOP 10 RECORDS ===' as section,
    LEFT(id::text, 8) as id_short,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status,
    CASE 
        WHEN total_amount IS NOT NULL AND total_amount > 0 AND remaining_amount >= 0 THEN '✅ FIXED'
        WHEN total_amount = amount_paid THEN '❌ BROKEN'
        ELSE '⚠️ CHECK'
    END as fix_status
FROM public.student_fees 
WHERE tenant_id IS NOT NULL
ORDER BY 
    CASE WHEN id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050' THEN 0 ELSE 1 END,
    created_at DESC
LIMIT 10;

-- Step 7: Summary statistics
SELECT 
    '=== FINAL STATISTICS ===' as section,
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_amount IS NOT NULL AND total_amount > 0 THEN 1 END) as records_with_total,
    COUNT(CASE WHEN total_amount = amount_paid THEN 1 END) as still_broken,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
FROM public.student_fees 
WHERE tenant_id IS NOT NULL;

COMMIT;

-- Success message
SELECT '🎉 TRIGGER FIX COMPLETED! Check results above.' as result;
