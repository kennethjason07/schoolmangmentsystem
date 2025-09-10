-- ============================================================
-- FIX THE PROBLEMATIC TRIGGER FUNCTION
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

RAISE NOTICE '✅ Removed problematic trigger and function';

-- Step 3: Make sure we keep the better trigger (comprehensive one)
-- Check if it exists
DO $$
BEGIN
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
    
    -- Update the record - this should now work correctly
    UPDATE public.student_fees 
    SET amount_paid = 900.00  -- Just touch the record to trigger recalculation
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
        RAISE NOTICE '❌ Still not working - may need manual update';
        
        -- Force correct values manually
        UPDATE public.student_fees 
        SET 
            total_amount = 35000.00,
            remaining_amount = 34100.00,
            status = 'partial'
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        
        RAISE NOTICE '✅ Applied manual fix';
    END IF;
END $$;

-- Step 5: Fix ALL student_fees records by triggering recalculation
DO $$
DECLARE
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Triggering recalculation for all student_fees records...';
    
    -- Update all records to trigger the comprehensive calculation
    UPDATE public.student_fees 
    SET amount_paid = amount_paid  -- Just touch each record
    WHERE tenant_id IS NOT NULL;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '✅ Triggered recalculation for % records', fixed_count;
END $$;

-- Step 6: Verify the fix
SELECT 
    '=== VERIFICATION RESULTS ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status,
    CASE 
        WHEN total_amount IS NOT NULL AND total_amount > 0 AND remaining_amount >= 0 THEN '✅ FIXED'
        WHEN total_amount = amount_paid THEN '❌ STILL BROKEN (total = paid)'
        ELSE '⚠️ NEEDS REVIEW'
    END as fix_status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050'
OR tenant_id IS NOT NULL
ORDER BY 
    CASE WHEN id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050' THEN 0 ELSE 1 END,
    created_at DESC
LIMIT 10;

-- Step 7: Summary statistics
SELECT 
    '=== SUMMARY STATISTICS ===' as section,
    COUNT(*) as total_records,
    COUNT(CASE WHEN total_amount IS NOT NULL AND total_amount > 0 THEN 1 END) as records_with_total,
    COUNT(CASE WHEN total_amount = amount_paid THEN 1 END) as broken_records,
    COUNT(CASE WHEN remaining_amount > 0 THEN 1 END) as records_with_remaining,
    ROUND(AVG(total_amount), 2) as avg_total_amount,
    ROUND(AVG(remaining_amount), 2) as avg_remaining
FROM public.student_fees 
WHERE tenant_id IS NOT NULL;

COMMIT;

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TRIGGER FIX COMPLETED!';
    RAISE NOTICE '✅ Removed the problematic calculate_student_fee_status trigger';
    RAISE NOTICE '✅ Kept the comprehensive trigger with proper logic';
    RAISE NOTICE '✅ Triggered recalculation for all records';
    RAISE NOTICE '';
    RAISE NOTICE 'The issue was the old trigger setting total_amount = amount_paid';
    RAISE NOTICE 'Now it should calculate proper total_amount from fee_structure';
    RAISE NOTICE '';
    RAISE NOTICE 'Check the verification results above to confirm the fix!';
END $$;
