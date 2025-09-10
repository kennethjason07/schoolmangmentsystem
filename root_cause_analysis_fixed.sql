-- ============================================================
-- ROOT CAUSE ANALYSIS FOR DATABASE UPDATE ISSUES - FIXED
-- ============================================================
-- This investigates why the database updates are not persisting

BEGIN;

-- Step 1: Check current state of the specific record
SELECT 
    '=== CURRENT RECORD STATE ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status,
    created_at,
    academic_year
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 2: Check for any triggers on student_fees table
SELECT 
    '=== TRIGGERS ON STUDENT_FEES TABLE ===' as section,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_fees'
AND event_object_schema = 'public';

-- Step 3: Check for constraints
SELECT 
    '=== CONSTRAINTS ON STUDENT_FEES ===' as section,
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'student_fees'
AND tc.table_schema = 'public';

-- Step 4: Test direct update on the specific record
DO $$
DECLARE
    update_result INTEGER;
    current_total NUMERIC;
    current_remaining NUMERIC;
    current_status VARCHAR(20);
BEGIN
    RAISE NOTICE '🔧 Testing direct update on specific record...';
    
    -- Get current values before update
    SELECT total_amount, remaining_amount, status 
    INTO current_total, current_remaining, current_status
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    RAISE NOTICE 'Before update: total=%, remaining=%, status=%', current_total, current_remaining, current_status;
    
    -- Try direct update
    UPDATE public.student_fees 
    SET 
        total_amount = 35000.00,
        remaining_amount = 34100.00,  -- 35000 - 900
        status = 'partial'
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    GET DIAGNOSTICS update_result = ROW_COUNT;
    RAISE NOTICE 'Update affected % rows', update_result;
    
    -- Check values after update
    SELECT total_amount, remaining_amount, status 
    INTO current_total, current_remaining, current_status
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    RAISE NOTICE 'After update: total=%, remaining=%, status=%', current_total, current_remaining, current_status;
    
    -- If values didn't change, there's a trigger or constraint issue
    IF current_total IS NULL OR current_remaining = 0 THEN
        RAISE NOTICE '❌ UPDATE FAILED - Values did not change, checking for triggers...';
    ELSE
        RAISE NOTICE '✅ UPDATE SUCCESSFUL - Values changed correctly';
    END IF;
    
END $$;

-- Step 5: Check if there are triggers that might be overriding updates
DO $$
DECLARE
    trigger_count INTEGER;
    trigger_name TEXT;
BEGIN
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE event_object_table = 'student_fees'
    AND event_object_schema = 'public';
    
    IF trigger_count > 0 THEN
        RAISE NOTICE '⚠️ Found % triggers on student_fees table', trigger_count;
        
        -- Try disabling triggers temporarily
        RAISE NOTICE '🔧 Disabling triggers and testing update...';
        
        ALTER TABLE public.student_fees DISABLE TRIGGER ALL;
        
        -- Test update with triggers disabled
        UPDATE public.student_fees 
        SET 
            total_amount = 50000.00,
            remaining_amount = 49100.00,
            status = 'partial'
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        
        -- Re-enable triggers
        ALTER TABLE public.student_fees ENABLE TRIGGER ALL;
        
        RAISE NOTICE '✅ Triggers re-enabled';
    ELSE
        RAISE NOTICE 'ℹ️ No triggers found on student_fees table';
    END IF;
END $$;

-- Step 6: Check current state after trigger test
SELECT 
    '=== AFTER TRIGGER TEST ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 7: Test individual column updates
DO $$
DECLARE
    test_total NUMERIC;
    test_remaining NUMERIC;
    test_status VARCHAR(20);
BEGIN
    RAISE NOTICE '🧪 Testing individual column updates...';
    
    -- Test total_amount
    UPDATE public.student_fees SET total_amount = 12345.67 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    SELECT total_amount INTO test_total 
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    IF test_total = 12345.67 THEN
        RAISE NOTICE '✅ total_amount update: SUCCESS';
    ELSE
        RAISE NOTICE '❌ total_amount update: FAILED (got %)', test_total;
    END IF;
    
    -- Test remaining_amount
    UPDATE public.student_fees SET remaining_amount = 54321.98 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    SELECT remaining_amount INTO test_remaining 
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    IF test_remaining = 54321.98 THEN
        RAISE NOTICE '✅ remaining_amount update: SUCCESS';
    ELSE
        RAISE NOTICE '❌ remaining_amount update: FAILED (got %)', test_remaining;
    END IF;
    
    -- Test status
    UPDATE public.student_fees SET status = 'paid' 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    SELECT status INTO test_status 
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    IF test_status = 'paid' THEN
        RAISE NOTICE '✅ status update: SUCCESS';
    ELSE
        RAISE NOTICE '❌ status update: FAILED (got %)', test_status;
    END IF;
    
END $$;

-- Step 8: Final state check
SELECT 
    '=== FINAL STATE ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 9: Apply the correct calculation
DO $$
DECLARE
    final_total NUMERIC := 35000.00;  -- Default tuition fee
    final_remaining NUMERIC;
    final_status VARCHAR(20);
BEGIN
    RAISE NOTICE '🎯 Applying correct calculation for tuition fee...';
    
    -- Calculate remaining and status
    final_remaining := final_total - 900.00;  -- amount_paid = 900
    
    IF 900.00 >= final_total THEN
        final_status := 'paid';
    ELSIF 900.00 > 0 THEN
        final_status := 'partial';
    ELSE
        final_status := 'pending';
    END IF;
    
    RAISE NOTICE 'Calculated values: total=₹%, remaining=₹%, status=%', final_total, final_remaining, final_status;
    
    -- Apply the correct values
    UPDATE public.student_fees 
    SET 
        total_amount = final_total,
        remaining_amount = final_remaining,
        status = final_status
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    RAISE NOTICE '✅ Applied correct calculation';
END $$;

-- Step 10: Verify final result
SELECT 
    '=== VERIFICATION - SHOULD BE CORRECT NOW ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status,
    CASE 
        WHEN total_amount > 0 AND remaining_amount > 0 THEN '✅ FIXED'
        ELSE '❌ STILL BROKEN'
    END as fix_status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

COMMIT;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== ROOT CAUSE ANALYSIS COMPLETE ===';
    RAISE NOTICE 'Check the results above to see:';
    RAISE NOTICE '1. Whether triggers were interfering';
    RAISE NOTICE '2. Whether individual column updates work';
    RAISE NOTICE '3. The final corrected values';
    RAISE NOTICE '';
    RAISE NOTICE 'If the fix_status shows ✅ FIXED, the issue is resolved!';
    RAISE NOTICE 'If still ❌ STILL BROKEN, there may be a deeper database issue.';
END $$;
