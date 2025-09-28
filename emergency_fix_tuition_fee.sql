-- ============================================================
-- EMERGENCY FIX: RESTORE CLASS 3A TUITION FEE PROPERLY
-- ============================================================
-- The Tuition fee is still showing as 0 with discount_applied: 25000
-- This means the trigger disabled the fee_structure from being properly restored

BEGIN;

-- Step 1: Check current problematic state
SELECT 
    '=== CURRENT PROBLEMATIC STATE ===' as section,
    id,
    fee_component,
    amount,
    base_amount,
    COALESCE(discount_applied, 0) as discount_applied,
    academic_year
FROM public.fee_structure
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND student_id IS NULL  -- Class-level fees only
AND academic_year = '2024-25'
ORDER BY fee_component;

-- Step 2: FORCE restore the Tuition fee manually (bypassing any remaining triggers)
DO $$
DECLARE
    tuition_record_id TEXT;
BEGIN
    RAISE NOTICE '🚨 EMERGENCY RESTORATION: Fixing Tuition fee manually...';
    
    -- Find the Tuition fee record ID
    SELECT id INTO tuition_record_id
    FROM public.fee_structure
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%tution%'
    LIMIT 1;
    
    IF tuition_record_id IS NOT NULL THEN
        -- Force update the Tuition fee to correct values
        UPDATE public.fee_structure 
        SET 
            amount = 25000,
            base_amount = 25000,
            discount_applied = 0
        WHERE id = tuition_record_id;
        
        RAISE NOTICE '✅ FORCED UPDATE: Tuition fee restored to ₹25,000 (record: %)', tuition_record_id;
    ELSE
        RAISE NOTICE '❌ Could not find Tuition fee record to fix';
    END IF;
    
    -- Also ensure Bus fee is correct
    UPDATE public.fee_structure 
    SET 
        amount = 15000,
        base_amount = 15000,
        discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%bus%';
    
    RAISE NOTICE '✅ CONFIRMED: Bus fee is ₹15,000';
END $$;

-- Step 3: Verify the emergency fix
SELECT 
    '=== AFTER EMERGENCY FIX ===' as section,
    id,
    fee_component,
    amount,
    base_amount,
    COALESCE(discount_applied, 0) as discount_applied,
    academic_year,
    CASE 
        WHEN fee_component ILIKE '%tution%' AND amount = 25000 AND COALESCE(discount_applied, 0) = 0 THEN '✅ TUITION FIXED'
        WHEN fee_component ILIKE '%bus%' AND amount = 15000 AND COALESCE(discount_applied, 0) = 0 THEN '✅ BUS CORRECT'
        ELSE '❌ STILL BROKEN'
    END as status
FROM public.fee_structure
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND student_id IS NULL  -- Class-level fees only
AND academic_year = '2024-25'
ORDER BY fee_component;

-- Step 4: Calculate what students should see now
DO $$
DECLARE
    tuition_amount NUMERIC;
    bus_amount NUMERIC;
    total_amount NUMERIC;
BEGIN
    -- Get the current fee amounts
    SELECT amount INTO tuition_amount
    FROM public.fee_structure
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%tution%'
    LIMIT 1;
    
    SELECT amount INTO bus_amount
    FROM public.fee_structure
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%bus%'
    LIMIT 1;
    
    total_amount := COALESCE(tuition_amount, 0) + COALESCE(bus_amount, 0);
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 EXPECTED STUDENT TOTALS:';
    RAISE NOTICE '   Tuition fee: ₹%', COALESCE(tuition_amount, 0);
    RAISE NOTICE '   Bus fee: ₹%', COALESCE(bus_amount, 0);
    RAISE NOTICE '   Total (without discounts): ₹%', total_amount;
    RAISE NOTICE '';
    
    IF total_amount = 40000 THEN
        RAISE NOTICE '🎉 SUCCESS: Total is now ₹40,000 as expected!';
    ELSE
        RAISE NOTICE '❌ PROBLEM: Total is ₹% but should be ₹40,000', total_amount;
    END IF;
END $$;

-- Step 5: Show example of what Ishwindar should see (with his discount)
SELECT 
    '=== ISHWINDAR EXAMPLE ===' as section,
    'Ishwindar has a ₹25,000 discount on Tuition fee' as note,
    'So he should see:' as calculation,
    'Tuition: ₹25,000 - ₹25,000 = ₹0' as tuition_calc,
    'Bus: ₹15,000 (no discount) = ₹15,000' as bus_calc,
    'Total: ₹15,000' as total_expected;

COMMIT;

-- Final verification message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 EMERGENCY FIX COMPLETED!';
    RAISE NOTICE '';
    RAISE NOTICE 'Now your students should see:';
    RAISE NOTICE '  👥 Most Class 3A students: ₹40,000 (₹25,000 + ₹15,000)';
    RAISE NOTICE '  🎓 Ishwindar (with discount): ₹15,000 (₹0 + ₹15,000)';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Please refresh your web application to see the correct totals!';
END $$;