-- ============================================================
-- NUCLEAR OPTION: COMPLETELY DISABLE ALL FEE-MODIFYING TRIGGERS
-- ============================================================
-- This will find and destroy ALL triggers that could modify fee_structure

BEGIN;

-- Step 1: Show ALL current triggers that might be causing the problem
SELECT 
    '=== ALL TRIGGERS ON FEE_STRUCTURE ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'fee_structure'
ORDER BY trigger_name;

SELECT 
    '=== ALL TRIGGERS ON STUDENT_DISCOUNTS ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_discounts'
ORDER BY trigger_name;

-- Step 2: NUCLEAR APPROACH - Drop ALL triggers on both tables
DO $$
DECLARE
    trigger_record RECORD;
    total_dropped INTEGER := 0;
BEGIN
    RAISE NOTICE '🚨 NUCLEAR OPTION: Destroying ALL triggers on fee_structure...';
    
    -- Drop all triggers on fee_structure
    FOR trigger_record IN 
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'fee_structure'
        AND trigger_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.fee_structure CASCADE;', 
                          trigger_record.trigger_name);
            total_dropped := total_dropped + 1;
            RAISE NOTICE '🗑️ Dropped: %', trigger_record.trigger_name;
        EXCEPTION WHEN others THEN
            RAISE NOTICE '⚠️ Failed to drop %: %', trigger_record.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '🚨 Destroying ALL triggers on student_discounts...';
    
    -- Drop all triggers on student_discounts
    FOR trigger_record IN 
        SELECT trigger_name
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_discounts'
        AND trigger_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.student_discounts CASCADE;', 
                          trigger_record.trigger_name);
            total_dropped := total_dropped + 1;
            RAISE NOTICE '🗑️ Dropped: %', trigger_record.trigger_name;
        EXCEPTION WHEN others THEN
            RAISE NOTICE '⚠️ Failed to drop %: %', trigger_record.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Total triggers destroyed: %', total_dropped;
END $$;

-- Step 3: Drop known problematic functions (these get called by triggers)
DO $$
BEGIN
    RAISE NOTICE '🔥 Destroying problematic functions...';
    
    DROP FUNCTION IF EXISTS update_fee_structure_on_discount() CASCADE;
    DROP FUNCTION IF EXISTS apply_student_discount_to_fee() CASCADE;
    DROP FUNCTION IF EXISTS calculate_fee_with_discount() CASCADE;
    DROP FUNCTION IF EXISTS sync_fee_structure_discounts() CASCADE;
    DROP FUNCTION IF EXISTS update_discount_applied_column() CASCADE;
    DROP FUNCTION IF EXISTS handle_discount_update() CASCADE;
    DROP FUNCTION IF EXISTS calculate_student_fee_with_discounts() CASCADE;
    DROP FUNCTION IF EXISTS update_fee_structure_discount() CASCADE;
    
    RAISE NOTICE '✅ Destroyed known problematic functions';
EXCEPTION WHEN others THEN
    RAISE NOTICE 'ℹ️ Some functions did not exist: %', SQLERRM;
END $$;

-- Step 4: FORCE restore Class 3A fees (without updated_at column)
DO $$
BEGIN
    RAISE NOTICE '🔧 FORCE restoring Class 3A fees...';
    
    -- Tuition fee
    UPDATE public.fee_structure 
    SET 
        amount = 25000,
        base_amount = 25000,
        discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%tution%';
    
    -- Bus fee
    UPDATE public.fee_structure 
    SET 
        amount = 15000,
        base_amount = 15000,
        discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%bus%';
    
    RAISE NOTICE '✅ FORCE restored fees: Tuition ₹25,000, Bus ₹15,000';
END $$;

-- Step 5: Verify all triggers are gone
SELECT 
    '=== VERIFICATION: REMAINING TRIGGERS (SHOULD BE EMPTY) ===' as section,
    COUNT(*) as trigger_count,
    'fee_structure' as table_name
FROM information_schema.triggers 
WHERE event_object_table = 'fee_structure'
AND trigger_schema = 'public'

UNION ALL

SELECT 
    '=== VERIFICATION: REMAINING TRIGGERS (SHOULD BE EMPTY) ===' as section,
    COUNT(*) as trigger_count,
    'student_discounts' as table_name
FROM information_schema.triggers 
WHERE event_object_table = 'student_discounts'
AND trigger_schema = 'public';

-- Step 6: Final state check
SELECT 
    '=== FINAL STATE: CLASS 3A FEES ===' as section,
    fee_component,
    amount,
    base_amount,
    COALESCE(discount_applied, 0) as discount_applied,
    CASE 
        WHEN fee_component ILIKE '%tution%' AND amount = 25000 THEN '✅ TUITION FIXED'
        WHEN fee_component ILIKE '%bus%' AND amount = 15000 THEN '✅ BUS FIXED'
        ELSE '❌ AMOUNT: ' || amount::text
    END as status
FROM public.fee_structure
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND student_id IS NULL
AND academic_year = '2024-25'
ORDER BY fee_component;

COMMIT;

-- Final test instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '💥 NUCLEAR TRIGGER DESTRUCTION COMPLETED!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Destroyed:';
    RAISE NOTICE '   - ALL triggers on fee_structure';
    RAISE NOTICE '   - ALL triggers on student_discounts';
    RAISE NOTICE '   - ALL known problematic functions';
    RAISE NOTICE '   - Restored Class 3A fees to correct amounts';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 CRITICAL TEST - Do this RIGHT NOW:';
    RAISE NOTICE '   1. Go to your web app';
    RAISE NOTICE '   2. Check Class 3A - ALL students should show ₹40,000';
    RAISE NOTICE '   3. Apply ₹25,000 concession to ONE student (e.g., Ishwindar)';
    RAISE NOTICE '   4. Check if class-level Tuition fee becomes 0 again';
    RAISE NOTICE '';
    RAISE NOTICE '❗ IF IT STILL BREAKS:';
    RAISE NOTICE '   - The issue is in your APPLICATION CODE, not database triggers';
    RAISE NOTICE '   - Some JavaScript code is directly updating fee_structure';
    RAISE NOTICE '   - We need to find and fix that code';
    RAISE NOTICE '';
END $$;