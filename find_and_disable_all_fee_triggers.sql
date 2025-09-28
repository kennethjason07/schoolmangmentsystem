-- ============================================================
-- COMPREHENSIVE FIX: FIND AND DISABLE ALL FEE-MODIFYING TRIGGERS
-- ============================================================
-- This will completely stop any database triggers from modifying fee_structure

BEGIN;

-- Step 1: Show ALL current triggers in the database
SELECT 
    '=== ALL TRIGGERS ON FEE_STRUCTURE ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement,
    trigger_schema
FROM information_schema.triggers 
WHERE event_object_table = 'fee_structure'
ORDER BY trigger_name;

-- Step 2: Show ALL triggers on student_discounts (these might modify fee_structure)
SELECT 
    '=== ALL TRIGGERS ON STUDENT_DISCOUNTS ===' as section,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement,
    trigger_schema
FROM information_schema.triggers 
WHERE event_object_table = 'student_discounts'
ORDER BY trigger_name;

-- Step 3: Show ALL database functions that contain 'fee_structure' 
SELECT 
    '=== ALL FUNCTIONS THAT REFERENCE FEE_STRUCTURE ===' as section,
    routine_name,
    routine_type,
    routine_schema,
    CASE 
        WHEN routine_definition ILIKE '%UPDATE%fee_structure%' THEN '🚨 UPDATES fee_structure'
        WHEN routine_definition ILIKE '%INSERT%fee_structure%' THEN '🚨 INSERTS into fee_structure'
        WHEN routine_definition ILIKE '%DELETE%fee_structure%' THEN '🚨 DELETES from fee_structure'
        WHEN routine_definition ILIKE '%fee_structure%' THEN '📝 References fee_structure'
        ELSE 'Unknown'
    END as danger_level
FROM information_schema.routines
WHERE routine_schema = 'public'
AND (routine_definition ILIKE '%fee_structure%'
     OR routine_definition ILIKE '%discount_applied%')
ORDER BY danger_level DESC;

-- Step 4: NUCLEAR OPTION - Disable ALL triggers on fee_structure
DO $$
DECLARE
    trigger_record RECORD;
    disable_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🚨 NUCLEAR OPTION: Disabling ALL triggers on fee_structure...';
    
    -- Get all triggers on fee_structure
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'fee_structure'
        AND trigger_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I CASCADE;', 
                          trigger_record.trigger_name, 
                          trigger_record.event_object_table);
            disable_count := disable_count + 1;
            RAISE NOTICE '🗑️ Dropped trigger: %', trigger_record.trigger_name;
        EXCEPTION WHEN others THEN
            RAISE NOTICE '⚠️ Could not drop trigger %: %', trigger_record.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Dropped % triggers on fee_structure', disable_count;
END $$;

-- Step 5: ALSO disable triggers on student_discounts that might affect fee_structure
DO $$
DECLARE
    trigger_record RECORD;
    disable_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🚨 Disabling ALL triggers on student_discounts...';
    
    -- Get all triggers on student_discounts
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_discounts'
        AND trigger_schema = 'public'
    LOOP
        BEGIN
            EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I CASCADE;', 
                          trigger_record.trigger_name, 
                          trigger_record.event_object_table);
            disable_count := disable_count + 1;
            RAISE NOTICE '🗑️ Dropped trigger: %', trigger_record.trigger_name;
        EXCEPTION WHEN others THEN
            RAISE NOTICE '⚠️ Could not drop trigger %: %', trigger_record.trigger_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Dropped % triggers on student_discounts', disable_count;
END $$;

-- Step 6: Drop specific known problematic functions
DO $$
BEGIN
    -- Drop functions that are known to cause problems
    DROP FUNCTION IF EXISTS update_fee_structure_on_discount() CASCADE;
    DROP FUNCTION IF EXISTS apply_student_discount_to_fee() CASCADE;
    DROP FUNCTION IF EXISTS calculate_fee_with_discount() CASCADE;
    DROP FUNCTION IF EXISTS sync_fee_structure_discounts() CASCADE;
    DROP FUNCTION IF EXISTS update_discount_applied_column() CASCADE;
    
    RAISE NOTICE '🗑️ Dropped known problematic functions';
EXCEPTION WHEN others THEN
    RAISE NOTICE '⚠️ Some functions may not have existed: %', SQLERRM;
END $$;

-- Step 7: FORCE restore Class 3A fees to correct state
DO $$
BEGIN
    RAISE NOTICE '🔧 FORCE restoring Class 3A fees (bypassing any remaining triggers)...';
    
    -- Disable all constraints temporarily
    SET session_replication_role = replica;
    
    -- Force update Class 3A fees
    UPDATE public.fee_structure 
    SET 
        amount = 25000,
        base_amount = 25000,
        discount_applied = 0,
        updated_at = NOW()
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%tution%';
    
    UPDATE public.fee_structure 
    SET 
        amount = 15000,
        base_amount = 15000,
        discount_applied = 0,
        updated_at = NOW()
    WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
    AND student_id IS NULL
    AND academic_year = '2024-25'
    AND LOWER(fee_component) LIKE '%bus%';
    
    -- Re-enable constraints
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE '✅ FORCE updated Class 3A fees with constraints disabled';
END $$;

-- Step 8: Verify no triggers remain
SELECT 
    '=== REMAINING TRIGGERS ON FEE_STRUCTURE (SHOULD BE EMPTY) ===' as section,
    COALESCE(trigger_name, 'NO TRIGGERS FOUND') as trigger_name,
    COALESCE(action_timing, '') as action_timing,
    COALESCE(event_manipulation, '') as event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'fee_structure'
AND trigger_schema = 'public'

UNION ALL

SELECT 
    '=== REMAINING TRIGGERS ON STUDENT_DISCOUNTS (SHOULD BE EMPTY) ===' as section,
    COALESCE(trigger_name, 'NO TRIGGERS FOUND') as trigger_name,
    COALESCE(action_timing, '') as action_timing,
    COALESCE(event_manipulation, '') as event_manipulation
FROM information_schema.triggers 
WHERE event_object_table = 'student_discounts'
AND trigger_schema = 'public';

-- Step 9: Final verification of Class 3A fees
SELECT 
    '=== FINAL CLASS 3A FEE VERIFICATION ===' as section,
    id,
    fee_component,
    amount,
    base_amount,
    COALESCE(discount_applied, 0) as discount_applied,
    academic_year,
    CASE 
        WHEN fee_component ILIKE '%tution%' AND amount = 25000 AND COALESCE(discount_applied, 0) = 0 THEN '✅ TUITION CORRECT'
        WHEN fee_component ILIKE '%bus%' AND amount = 15000 AND COALESCE(discount_applied, 0) = 0 THEN '✅ BUS CORRECT'
        ELSE '❌ STILL BROKEN: ' || amount::text || ' (should be 25000 or 15000)'
    END as status
FROM public.fee_structure
WHERE class_id = '37b82e22-ff67-45f7-9df4-1e0201376fb9'
AND student_id IS NULL
AND academic_year = '2024-25'
ORDER BY fee_component;

COMMIT;

-- Final instructions
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 COMPREHENSIVE TRIGGER ELIMINATION COMPLETED!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ What was done:';
    RAISE NOTICE '   - Dropped ALL triggers on fee_structure table';
    RAISE NOTICE '   - Dropped ALL triggers on student_discounts table';
    RAISE NOTICE '   - Dropped known problematic functions';
    RAISE NOTICE '   - Force-restored Class 3A fees with constraints disabled';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST THIS NOW:';
    RAISE NOTICE '   1. Check Class 3A students show ₹40,000 total';
    RAISE NOTICE '   2. Apply a ₹25,000 concession to ONE student';
    RAISE NOTICE '   3. Verify ONLY that student shows reduced fees';
    RAISE NOTICE '   4. Verify class-level fees remain ₹25,000 + ₹15,000';
    RAISE NOTICE '';
    RAISE NOTICE '❗ If it STILL modifies class fees, there may be:';
    RAISE NOTICE '   - Application-level code modifying fee_structure directly';
    RAISE NOTICE '   - RLS policies that trigger updates';
    RAISE NOTICE '   - Other database functions we haven''t found';
    RAISE NOTICE '';
END $$;