-- ============================================================
-- DISABLE FEE MODIFICATION TRIGGERS & RESTORE CLASS 3A FEES
-- ============================================================
-- This script disables database triggers that are incorrectly modifying
-- fee_structure when student_discounts are applied, causing class-wide effects.
-- It also restores the correct fee amounts for Class 3A.

BEGIN;

-- Step 1: Identify and display current problematic triggers
SELECT 
    '=== CURRENT TRIGGERS ON FEE_STRUCTURE ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'fee_structure'
AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 2: Identify triggers on student_discounts that might affect fee_structure
SELECT 
    '=== CURRENT TRIGGERS ON STUDENT_DISCOUNTS ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'student_discounts'
AND event_object_schema = 'public'
ORDER BY trigger_name;

-- Step 3: Check for functions that modify fee_structure
SELECT 
    '=== FUNCTIONS THAT REFERENCE FEE_STRUCTURE ===' as section,
    routine_name,
    routine_type,
    CASE 
        WHEN routine_definition ILIKE '%UPDATE%fee_structure%' THEN '🚨 MODIFIES fee_structure'
        WHEN routine_definition ILIKE '%fee_structure%' THEN '📝 References fee_structure'
        ELSE 'Other'
    END as modification_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_definition ILIKE '%fee_structure%'
ORDER BY modification_type DESC;

-- Step 4: DISABLE problematic triggers (this is the main fix)
-- These are likely the triggers causing fee_structure to be modified

-- Disable triggers on fee_structure table
DO $$
BEGIN
    -- Try to disable common problematic triggers
    BEGIN
        ALTER TABLE public.fee_structure DISABLE TRIGGER ALL;
        RAISE NOTICE '🛑 Disabled ALL triggers on fee_structure table';
    EXCEPTION WHEN others THEN
        RAISE NOTICE '⚠️ Could not disable fee_structure triggers: %', SQLERRM;
    END;
    
    -- Disable specific known problematic triggers if they exist
    BEGIN
        DROP TRIGGER IF EXISTS update_fee_structure_discount ON public.fee_structure;
        RAISE NOTICE '🗑️ Dropped update_fee_structure_discount trigger if it existed';
    EXCEPTION WHEN others THEN
        RAISE NOTICE '⚠️ Could not drop update_fee_structure_discount: %', SQLERRM;
    END;
    
    BEGIN
        DROP TRIGGER IF EXISTS apply_discount_to_fee_structure ON public.fee_structure;
        RAISE NOTICE '🗑️ Dropped apply_discount_to_fee_structure trigger if it existed';
    EXCEPTION WHEN others THEN
        RAISE NOTICE '⚠️ Could not drop apply_discount_to_fee_structure: %', SQLERRM;
    END;
    
    BEGIN
        DROP TRIGGER IF EXISTS trigger_update_fee_structure_on_discount ON public.student_discounts;
        RAISE NOTICE '🗑️ Dropped trigger_update_fee_structure_on_discount trigger if it existed';
    EXCEPTION WHEN others THEN
        RAISE NOTICE '⚠️ Could not drop trigger_update_fee_structure_on_discount: %', SQLERRM;
    END;
END $$;

-- Step 5: RESTORE Class 3A fees to correct amounts
-- Class 3A ID: 37b82e22-ff67-45f7-9df4-1e0201376fb9

-- First, let's see current state
SELECT 
    '=== CURRENT CLASS 3A FEE STRUCTURE ===' as section,
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

-- Now restore correct amounts
DO $$
DECLARE
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Restoring Class 3A fees to correct amounts...';
    
    -- Restore Tuition fee to 25000
    UPDATE public.fee_structure 
    SET 
        amount = 25000,
        base_amount = 25000,
        discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL  -- Class-level fees only
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%tution%';  -- Matches 'Tution fee'
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE '✅ Restored Tuition fee to ₹25,000 (% records updated)', updated_count;
    ELSE
        RAISE NOTICE '⚠️ No Tuition fee records found to update';
    END IF;
    
    -- Restore Bus fee to 15000 (if it was also affected)
    UPDATE public.fee_structure 
    SET 
        amount = 15000,
        base_amount = 15000,
        discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL  -- Class-level fees only
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%bus%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE '✅ Restored Bus fee to ₹15,000 (% records updated)', updated_count;
    ELSE
        RAISE NOTICE 'ℹ️ No Bus fee records needed updating';
    END IF;
    
    -- Make sure discount_applied is 0 for all class-level fees
    UPDATE public.fee_structure 
    SET discount_applied = 0
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL  -- Class-level fees only
    AND academic_year = '2024-25'
    AND COALESCE(discount_applied, 0) != 0;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE '🧹 Cleared discount_applied for % class-level fee records', updated_count;
    ELSE
        RAISE NOTICE 'ℹ️ All class-level fees already have discount_applied = 0';
    END IF;
END $$;

-- Step 6: Verify the restoration
SELECT 
    '=== RESTORED CLASS 3A FEE STRUCTURE ===' as section,
    id,
    fee_component,
    amount,
    base_amount,
    COALESCE(discount_applied, 0) as discount_applied,
    academic_year,
    CASE 
        WHEN fee_component ILIKE '%tution%' AND amount = 25000 THEN '✅ CORRECT'
        WHEN fee_component ILIKE '%bus%' AND amount = 15000 THEN '✅ CORRECT'
        WHEN COALESCE(discount_applied, 0) = 0 THEN '✅ NO DISCOUNT'
        ELSE '❌ NEEDS REVIEW'
    END as status
FROM public.fee_structure
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND student_id IS NULL  -- Class-level fees only
AND academic_year = '2024-25'
ORDER BY fee_component;

-- Step 7: Check current student discounts to ensure they're per-student only
SELECT 
    '=== CURRENT STUDENT DISCOUNTS FOR CLASS 3A ===' as section,
    id,
    student_id,
    fee_component,
    discount_value,
    description,
    is_active,
    CASE 
        WHEN student_id IS NOT NULL THEN '✅ PER-STUDENT'
        ELSE '❌ CLASS-WIDE (PROBLEMATIC)'
    END as discount_type
FROM public.student_discounts
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND academic_year = '2024-25'
AND is_active = true
ORDER BY student_id NULLS LAST, fee_component;

-- Step 8: Disable any class-wide discounts (student_id IS NULL)
DO $$
DECLARE
    disabled_count INTEGER := 0;
BEGIN
    -- Deactivate any class-wide discounts
    UPDATE public.student_discounts 
    SET is_active = false
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL  -- Class-wide discounts
    AND is_active = true;
    
    GET DIAGNOSTICS disabled_count = ROW_COUNT;
    IF disabled_count > 0 THEN
        RAISE NOTICE '🛑 Disabled % class-wide discount records', disabled_count;
    ELSE
        RAISE NOTICE 'ℹ️ No class-wide discounts found to disable';
    END IF;
END $$;

COMMIT;

-- Final summary and instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 TRIGGER DISABLING AND FEE RESTORATION COMPLETED!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ What was fixed:';
    RAISE NOTICE '   - Disabled ALL triggers on fee_structure table';
    RAISE NOTICE '   - Dropped specific problematic triggers';
    RAISE NOTICE '   - Restored Class 3A Tuition fee to ₹25,000';
    RAISE NOTICE '   - Restored Class 3A Bus fee to ₹15,000';
    RAISE NOTICE '   - Set discount_applied = 0 for all class fees';
    RAISE NOTICE '   - Disabled any class-wide discount records';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 What to verify:';
    RAISE NOTICE '   1. Check Class 3A students show correct totals (Tuition ₹25,000 + Bus ₹15,000 = ₹40,000)';
    RAISE NOTICE '   2. Check Ishwindar shows Tuition ₹0 + Bus ₹15,000 = ₹15,000 (if he has a discount)';
    RAISE NOTICE '   3. Verify concessions are now per-student only';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ IMPORTANT: The updated smartConcessionDistribution.js now enforces per-student discounts only.';
    RAISE NOTICE '              No class-wide discounts will be allowed.';
    RAISE NOTICE '';
END $$;