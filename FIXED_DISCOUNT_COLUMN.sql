-- ========================================
-- FIXED DISCOUNT_APPLIED COLUMN SCRIPT
-- ========================================
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Add the missing discount_applied column
DO $$
BEGIN
    -- Check if the column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'fee_structure' 
        AND column_name = 'discount_applied'
    ) THEN
        -- Add the missing column
        ALTER TABLE public.fee_structure 
        ADD COLUMN discount_applied numeric DEFAULT 0;
        
        RAISE NOTICE '✅ Added missing discount_applied column to fee_structure table';
    ELSE
        RAISE NOTICE '📋 discount_applied column already exists in fee_structure table';
    END IF;
END $$;

-- Step 2: Check for triggers and functions in one block
DO $$
DECLARE
    trigger_record RECORD;
    function_record RECORD;
    trigger_count INTEGER := 0;
    function_count INTEGER := 0;
    test_student_id UUID;
    test_class_id UUID;
    test_tenant_id UUID;
    test_discount_id UUID;
BEGIN
    RAISE NOTICE '📋 Checking for triggers on student_discounts table...';
    
    -- Find all triggers on student_discounts table
    FOR trigger_record IN 
        SELECT trigger_name, event_manipulation, action_statement, action_timing
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_discounts'
    LOOP
        trigger_count := trigger_count + 1;
        RAISE NOTICE '🚨 FOUND TRIGGER: % (% %) - %', 
            trigger_record.trigger_name, 
            trigger_record.action_timing,
            trigger_record.event_manipulation,
            LEFT(trigger_record.action_statement, 100);
    END LOOP;
    
    IF trigger_count = 0 THEN
        RAISE NOTICE '✅ No triggers found on student_discounts table';
    ELSE
        RAISE NOTICE '⚠️ Found % trigger(s) on student_discounts table', trigger_count;
        RAISE NOTICE 'These triggers might be causing the discount_applied error';
    END IF;

    RAISE NOTICE '📋 Checking for functions that reference discount_applied...';
    
    -- Find all functions that mention discount_applied
    FOR function_record IN 
        SELECT routine_name, routine_type
        FROM information_schema.routines 
        WHERE routine_schema = 'public'
        AND routine_definition ILIKE '%discount_applied%'
    LOOP
        function_count := function_count + 1;
        RAISE NOTICE '🚨 FOUND FUNCTION: % (%)', 
            function_record.routine_name,
            function_record.routine_type;
    END LOOP;
    
    IF function_count = 0 THEN
        RAISE NOTICE '✅ No functions found referencing discount_applied';
    ELSE
        RAISE NOTICE '⚠️ Found % function(s) referencing discount_applied', function_count;
    END IF;

    RAISE NOTICE '📋 Testing discount insertion...';
    
    -- Get a real student for testing
    SELECT id, class_id, tenant_id INTO test_student_id, test_class_id, test_tenant_id
    FROM public.students 
    LIMIT 1;
    
    IF test_student_id IS NULL THEN
        RAISE NOTICE '⚠️ No students found for testing';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using test student: %', test_student_id;
    
    -- Try to insert a test discount
    BEGIN
        INSERT INTO public.student_discounts (
            student_id,
            class_id,
            academic_year,
            discount_type,
            discount_value,
            fee_component,
            description,
            tenant_id,
            is_active
        ) VALUES (
            test_student_id,
            test_class_id,
            '2024-25',
            'fixed_amount',
            100,
            'Test Fee',
            'Test discount for debugging',
            test_tenant_id,
            true
        ) RETURNING id INTO test_discount_id;
        
        RAISE NOTICE '✅ SUCCESS! Test discount created with ID: %', test_discount_id;
        
        -- Clean up the test discount
        DELETE FROM public.student_discounts WHERE id = test_discount_id;
        RAISE NOTICE '🧹 Test discount cleaned up';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ DISCOUNT INSERTION FAILED: %', SQLERRM;
        RAISE NOTICE 'Error code: %', SQLSTATE;
        
        -- If it's still the discount_applied error, suggest disabling triggers
        IF SQLERRM ILIKE '%discount_applied%' THEN
            RAISE NOTICE '🚨 The error is still related to discount_applied column';
            RAISE NOTICE 'This suggests there are triggers or functions still trying to access it';
            RAISE NOTICE 'You may need to temporarily disable triggers:';
            RAISE NOTICE 'ALTER TABLE student_discounts DISABLE TRIGGER ALL;';
        END IF;
    END;

    RAISE NOTICE '';
    RAISE NOTICE '🎯 SUMMARY AND NEXT STEPS:';
    RAISE NOTICE '1. The discount_applied column has been added to fee_structure table';
    RAISE NOTICE '2. Any problematic triggers or functions have been identified above';
    RAISE NOTICE '3. Test discount insertion result shown above';
    RAISE NOTICE '';
    RAISE NOTICE 'If the test still failed with discount_applied error:';
    RAISE NOTICE '- There are hidden triggers or functions still referencing the column';
    RAISE NOTICE '- You may need to disable triggers temporarily to test';
    RAISE NOTICE '- Run: ALTER TABLE student_discounts DISABLE TRIGGER ALL;';
    RAISE NOTICE '- Test your app, then re-enable: ALTER TABLE student_discounts ENABLE TRIGGER ALL;';
    RAISE NOTICE '';
END $$;

-- Final verification
SELECT 
    'VERIFICATION: discount_applied column' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'fee_structure' 
            AND column_name = 'discount_applied'
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status;

SELECT '🎉 Fix script completed! Check the output above for results.' as final_message;
