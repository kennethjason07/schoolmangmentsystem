-- ============================================================
-- SIMPLE TARGETED FIX FOR STUDENT FEE PAYMENT ISSUE
-- ============================================================
-- This addresses the most common causes of 0 amounts showing

-- Step 1: Check if fee_structure has any data at all
DO $$
DECLARE
    fee_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fee_count FROM public.fee_structure;
    
    IF fee_count = 0 THEN
        RAISE NOTICE 'NO FEE STRUCTURE DATA FOUND - Creating sample data...';
        
        -- Create sample fee data for existing classes
        INSERT INTO public.fee_structure (
            academic_year, class_id, fee_component, amount, base_amount, tenant_id, due_date
        )
        SELECT 
            '2024-2025' as academic_year,
            c.id as class_id,
            'Tuition Fee' as fee_component,
            5000 as amount,
            5000 as base_amount,
            c.tenant_id,
            CURRENT_DATE + INTERVAL '30 days' as due_date
        FROM public.classes c
        LIMIT 5;
        
        RAISE NOTICE 'Sample fee structure created for % classes', (SELECT COUNT(*) FROM public.classes LIMIT 5);
    ELSE
        RAISE NOTICE 'Fee structure data exists: % records', fee_count;
    END IF;
END $$;

-- Step 2: Create missing RLS policy for fee_structure if it doesn't exist
DO $$
BEGIN
    -- Check if policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'fee_structure' 
          AND policyname = 'fee_structure_email_tenant_access'
    ) THEN
        CREATE POLICY fee_structure_email_tenant_access ON public.fee_structure
        FOR ALL USING (
            -- Allow access if fee belongs to user's tenant
            tenant_id IN (
                SELECT u.tenant_id 
                FROM public.users u 
                WHERE u.id = auth.uid()
            )
        );
        RAISE NOTICE 'Created fee_structure RLS policy';
    ELSE
        RAISE NOTICE 'fee_structure RLS policy already exists';
    END IF;
END $$;

-- Step 3: Create missing RLS policy for student_fees if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'student_fees' 
          AND policyname = 'student_fees_email_tenant_access'
    ) THEN
        CREATE POLICY student_fees_email_tenant_access ON public.student_fees
        FOR ALL USING (
            -- Allow access if payment belongs to user's tenant
            tenant_id IN (
                SELECT u.tenant_id 
                FROM public.users u 
                WHERE u.id = auth.uid()
            )
            OR
            -- Allow if user is the student who made the payment
            student_id IN (
                SELECT u.linked_student_id 
                FROM public.users u 
                WHERE u.id = auth.uid()
            )
        );
        RAISE NOTICE 'Created student_fees RLS policy';
    ELSE
        RAISE NOTICE 'student_fees RLS policy already exists';
    END IF;
END $$;

-- Step 4: Ensure users can access their own records and tenant data
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename = 'users' 
          AND policyname = 'users_email_tenant_access'
    ) THEN
        CREATE POLICY users_email_tenant_access ON public.users
        FOR ALL USING (
            -- Allow users to access their own record and others in same tenant
            id = auth.uid()
            OR
            tenant_id IN (
                SELECT u.tenant_id 
                FROM public.users u 
                WHERE u.id = auth.uid()
            )
        );
        RAISE NOTICE 'Created users RLS policy';
    ELSE
        RAISE NOTICE 'users RLS policy already exists - skipping';
    END IF;
END $$;

-- Step 5: Test the fee calculation for first student user
DO $$
DECLARE
    test_user_email TEXT;
    test_student_id UUID;
    test_tenant_id UUID;
    fee_count INTEGER;
BEGIN
    -- Get first student user
    SELECT u.email, u.linked_student_id, u.tenant_id 
    INTO test_user_email, test_student_id, test_tenant_id
    FROM public.users u 
    WHERE u.linked_student_id IS NOT NULL 
    LIMIT 1;
    
    IF test_student_id IS NOT NULL THEN
        -- Check if this student has accessible fees
        SELECT COUNT(*) INTO fee_count
        FROM public.fee_structure fs
        JOIN public.students s ON s.class_id = fs.class_id
        WHERE s.id = test_student_id
          AND fs.tenant_id = test_tenant_id
          AND fs.student_id IS NULL;
          
        RAISE NOTICE 'Test Results:';
        RAISE NOTICE '  Student Email: %', test_user_email;
        RAISE NOTICE '  Student ID: %', test_student_id;
        RAISE NOTICE '  Tenant ID: %', test_tenant_id;
        RAISE NOTICE '  Accessible Fees: %', fee_count;
        
        IF fee_count = 0 THEN
            RAISE NOTICE 'WARNING: No fees found for test student - this could be why amounts show as 0';
        END IF;
    ELSE
        RAISE NOTICE 'No student users found for testing';
    END IF;
END $$;

-- Step 6: Show summary
SELECT 
    'FIX COMPLETE' as status,
    'Check the NOTICE messages above for results' as message,
    'If amounts still show 0, there may be no fee data for your student' as possible_issue;

-- Show current fee structure count
SELECT 
    'CURRENT DATA' as type,
    COUNT(*) as total_fees,
    COUNT(DISTINCT class_id) as classes_with_fees,
    COUNT(DISTINCT tenant_id) as tenants_with_fees
FROM public.fee_structure
WHERE student_id IS NULL;
