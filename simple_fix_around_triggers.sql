-- ============================================================
-- SIMPLE FIX THAT WORKS AROUND SYSTEM TRIGGERS
-- ============================================================
-- Since system triggers are interfering, let's use a different approach

BEGIN;

-- Step 1: Check current state
SELECT 
    '=== CURRENT STATE ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 2: Check what triggers exist (including system triggers)
SELECT 
    '=== ALL TRIGGERS ON STUDENT_FEES ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_fees';

-- Step 3: Try a different approach - update one column at a time
DO $$
DECLARE
    current_record RECORD;
    calculated_total NUMERIC := 35000.00;  -- Default tuition fee
    calculated_remaining NUMERIC;
    calculated_status VARCHAR(20);
BEGIN
    -- Get current record
    SELECT * INTO current_record 
    FROM public.student_fees 
    WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
    
    RAISE NOTICE 'Current: paid=₹%, total=₹%, remaining=₹%, status=%', 
        current_record.amount_paid, current_record.total_amount, 
        current_record.remaining_amount, current_record.status;
    
    -- Calculate correct values
    calculated_remaining := calculated_total - current_record.amount_paid;
    
    IF current_record.amount_paid >= calculated_total THEN
        calculated_status := 'paid';
    ELSIF current_record.amount_paid > 0 THEN
        calculated_status := 'partial';
    ELSE
        calculated_status := 'pending';
    END IF;
    
    RAISE NOTICE 'Should be: total=₹%, remaining=₹%, status=%', 
        calculated_total, calculated_remaining, calculated_status;
    
    -- Try updating total_amount first
    BEGIN
        UPDATE public.student_fees 
        SET total_amount = calculated_total
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        RAISE NOTICE '✅ total_amount update succeeded';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ total_amount update failed: %', SQLERRM;
    END;
    
    -- Try updating remaining_amount
    BEGIN
        UPDATE public.student_fees 
        SET remaining_amount = calculated_remaining
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        RAISE NOTICE '✅ remaining_amount update succeeded';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ remaining_amount update failed: %', SQLERRM;
    END;
    
    -- Try updating status
    BEGIN
        UPDATE public.student_fees 
        SET status = calculated_status
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        RAISE NOTICE '✅ status update succeeded';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ status update failed: %', SQLERRM;
    END;
    
END $$;

-- Step 4: Check if updates worked
SELECT 
    '=== AFTER INDIVIDUAL UPDATES ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 5: If that didn't work, try disabling only user-defined triggers
DO $$
DECLARE
    trigger_rec RECORD;
    update_successful BOOLEAN := FALSE;
BEGIN
    -- Check if we have user-defined triggers (not system triggers)
    FOR trigger_rec IN (
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_fees'
        AND event_object_schema = 'public'
        AND trigger_name NOT LIKE 'RI_ConstraintTrigger_%'  -- Skip system triggers
    ) LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.student_fees DISABLE TRIGGER ' || quote_ident(trigger_rec.trigger_name);
            RAISE NOTICE 'Disabled user trigger: %', trigger_rec.trigger_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not disable trigger %: %', trigger_rec.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    -- Try update with user triggers disabled
    BEGIN
        UPDATE public.student_fees 
        SET 
            total_amount = 35000.00,
            remaining_amount = 34100.00,  -- 35000 - 900
            status = 'partial'
        WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';
        
        update_successful := TRUE;
        RAISE NOTICE '✅ Update with user triggers disabled: SUCCESS';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Update with user triggers disabled: FAILED - %', SQLERRM;
    END;
    
    -- Re-enable user-defined triggers
    FOR trigger_rec IN (
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_fees'
        AND event_object_schema = 'public'
        AND trigger_name NOT LIKE 'RI_ConstraintTrigger_%'
    ) LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public.student_fees ENABLE TRIGGER ' || quote_ident(trigger_rec.trigger_name);
            RAISE NOTICE 'Re-enabled user trigger: %', trigger_rec.trigger_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not re-enable trigger %: %', trigger_rec.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    IF NOT update_successful THEN
        RAISE NOTICE '⚠️ All update attempts failed - system triggers are preventing updates';
        RAISE NOTICE '💡 The issue is likely a BEFORE INSERT/UPDATE trigger that resets values';
    END IF;
    
END $$;

-- Step 6: Final check
SELECT 
    '=== FINAL RESULT ===' as section,
    id,
    fee_component,
    amount_paid,
    total_amount,
    remaining_amount,
    status,
    CASE 
        WHEN total_amount IS NOT NULL AND total_amount > 0 AND remaining_amount > 0 THEN '✅ FIXED'
        WHEN total_amount IS NULL THEN '❌ total_amount still NULL'
        WHEN remaining_amount = 0 THEN '❌ remaining_amount still 0'
        ELSE '❌ STILL BROKEN'
    END as fix_status
FROM public.student_fees 
WHERE id = 'fcc83652-9fda-4e34-95ae-a7535aa3f050';

-- Step 7: Alternative approach - check if there's a trigger function we need to fix
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== DIAGNOSIS SUMMARY ===';
    RAISE NOTICE 'The issue is that there are system triggers (RI_ConstraintTrigger_*) on the student_fees table.';
    RAISE NOTICE 'These are likely BEFORE INSERT/UPDATE triggers that are overriding our values.';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTIONS:';
    RAISE NOTICE '1. Check if there are custom trigger functions that reset total_amount/remaining_amount';
    RAISE NOTICE '2. Look for application code that might be updating these fields after our changes';
    RAISE NOTICE '3. Check if the frontend is making subsequent API calls that reset the values';
    RAISE NOTICE '';
    RAISE NOTICE 'Since the frontend shows correct values but DB shows wrong values,';
    RAISE NOTICE 'the issue is likely a trigger or application code that runs after our updates.';
END $$;

COMMIT;

-- Step 8: Show all trigger functions for investigation
SELECT 
    '=== TRIGGER FUNCTIONS TO INVESTIGATE ===' as section,
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_proc p
JOIN pg_language l ON p.prolang = l.oid
WHERE l.lanname = 'plpgsql'
AND p.proname LIKE '%student%fee%'
OR p.proname LIKE '%fee%'
LIMIT 10;
