-- Sample Data for Fee Management Testing
-- Run this AFTER running fix_fee_management_rls.sql
-- This creates basic classes, students, and fee structures for testing

-- ========================================
-- STEP 1: Create sample classes
-- ========================================

-- Create classes for the tenant (only if they don't exist)
DO $$
BEGIN
  -- Check if classes exist for this tenant
  IF (SELECT COUNT(*) FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
    
    INSERT INTO public.classes (class_name, section, tenant_id, created_at, updated_at) VALUES
    ('Class 1', 'A', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Class 2', 'A', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Class 3', 'A', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Class 4', 'A', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
    ('Class 5', 'A', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW());
    
    RAISE NOTICE '✅ Sample classes created successfully!';
  ELSE
    RAISE NOTICE '📋 Classes already exist for this tenant, skipping creation.';
  END IF;
END $$;

-- ========================================
-- STEP 2: Update existing students to have proper class_id references
-- ========================================

-- Get the class IDs we just created and update students to reference them
DO $$
DECLARE
    class_1_id UUID;
    class_2_id UUID;
    class_3_id UUID;
    class_4_id UUID;
    class_5_id UUID;
    student_count INTEGER;
BEGIN
    -- Get class IDs for this tenant
    SELECT id INTO class_1_id FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' AND class_name = 'Class 1' LIMIT 1;
    SELECT id INTO class_2_id FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' AND class_name = 'Class 2' LIMIT 1;
    SELECT id INTO class_3_id FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' AND class_name = 'Class 3' LIMIT 1;
    SELECT id INTO class_4_id FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' AND class_name = 'Class 4' LIMIT 1;
    SELECT id INTO class_5_id FROM public.classes WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000' AND class_name = 'Class 5' LIMIT 1;
    
    -- Check if we have students to update
    SELECT COUNT(*) INTO student_count FROM public.students WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';
    
    IF student_count > 0 THEN
        -- Distribute students across classes
        -- Update students to reference the correct class IDs (distribute evenly)
        WITH numbered_students AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn
            FROM public.students 
            WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        )
        UPDATE public.students 
        SET class_id = CASE 
            WHEN (SELECT rn FROM numbered_students WHERE numbered_students.id = students.id) % 5 = 1 THEN class_1_id
            WHEN (SELECT rn FROM numbered_students WHERE numbered_students.id = students.id) % 5 = 2 THEN class_2_id
            WHEN (SELECT rn FROM numbered_students WHERE numbered_students.id = students.id) % 5 = 3 THEN class_3_id
            WHEN (SELECT rn FROM numbered_students WHERE numbered_students.id = students.id) % 5 = 4 THEN class_4_id
            ELSE class_5_id
        END
        WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';
        
        RAISE NOTICE '✅ Updated % students with proper class references!', student_count;
    ELSE
        RAISE NOTICE '⚠️ No students found for this tenant.';
    END IF;
END $$;

-- ========================================
-- STEP 3: Create sample fee structures
-- ========================================

-- Create fee structures for each class
DO $$
DECLARE
    class_record RECORD;
BEGIN
    -- Check if fee structures exist for this tenant
    IF (SELECT COUNT(*) FROM public.fee_structure WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
        
        -- Create fee structures for each class
        FOR class_record IN 
            SELECT id, class_name FROM public.classes 
            WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
        LOOP
            -- Insert multiple fee types for each class
            INSERT INTO public.fee_structure (
                class_id, 
                fee_component, 
                amount, 
                academic_year, 
                due_date, 
                tenant_id,
                created_at,
                updated_at
            ) VALUES
            (class_record.id, 'Tuition Fee', 5000.00, '2024-25', '2025-04-15', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
            (class_record.id, 'Library Fee', 500.00, '2024-25', '2025-04-30', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
            (class_record.id, 'Lab Fee', 800.00, '2024-25', '2025-05-15', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
            (class_record.id, 'Sports Fee', 300.00, '2024-25', '2025-05-30', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW()),
            (class_record.id, 'Bus Fee', 1200.00, '2024-25', '2025-04-10', 'b8f8b5f0-1234-4567-8901-123456789000', NOW(), NOW());
        END LOOP;
        
        RAISE NOTICE '✅ Sample fee structures created for all classes!';
    ELSE
        RAISE NOTICE '📋 Fee structures already exist for this tenant, skipping creation.';
    END IF;
END $$;

-- ========================================
-- STEP 4: Create some sample payments
-- ========================================

-- Create sample payments for a few students
DO $$
DECLARE
    student_record RECORD;
    fee_record RECORD;
    payment_count INTEGER := 0;
BEGIN
    -- Check if payments exist for this tenant
    IF (SELECT COUNT(*) FROM public.student_fees WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000') = 0 THEN
        
        -- Create payments for first 10 students (partial payments)
        FOR student_record IN 
            SELECT s.id as student_id, s.name, c.class_name
            FROM public.students s
            JOIN public.classes c ON s.class_id = c.id
            WHERE s.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
            LIMIT 10
        LOOP
            -- Get a random fee for this student's class
            SELECT fs.id, fs.fee_component, fs.amount INTO fee_record
            FROM public.fee_structure fs
            JOIN public.classes c ON fs.class_id = c.id
            JOIN public.students s ON s.class_id = c.id
            WHERE s.id = student_record.student_id
            AND fs.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
            ORDER BY RANDOM()
            LIMIT 1;
            
            IF fee_record.id IS NOT NULL THEN
                -- Create a partial payment (50-100% of fee amount)
                INSERT INTO public.student_fees (
                    student_id,
                    fee_id,
                    amount_paid,
                    payment_date,
                    status,
                    tenant_id,
                    created_at,
                    updated_at
                ) VALUES (
                    student_record.student_id,
                    fee_record.id,
                    (fee_record.amount * (0.5 + RANDOM() * 0.5))::DECIMAL(10,2), -- 50-100% payment
                    (CURRENT_DATE - (RANDOM() * 30)::INTEGER), -- Random date in last 30 days
                    CASE WHEN RANDOM() > 0.3 THEN 'paid' ELSE 'partial' END,
                    'b8f8b5f0-1234-4567-8901-123456789000',
                    NOW(),
                    NOW()
                );
                
                payment_count := payment_count + 1;
            END IF;
        END LOOP;
        
        RAISE NOTICE '✅ Created % sample payments!', payment_count;
    ELSE
        RAISE NOTICE '📋 Payments already exist for this tenant, skipping creation.';
    END IF;
END $$;

-- ========================================
-- STEP 5: Verify the created data
-- ========================================

-- Show what we created
SELECT 'Data Summary for Tenant b8f8b5f0-1234-4567-8901-123456789000:' as info;

SELECT 'Classes created:' as table_name, COUNT(*) as count 
FROM public.classes 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
UNION ALL
SELECT 'Students with class references:', COUNT(*) 
FROM public.students 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
AND class_id IS NOT NULL
UNION ALL
SELECT 'Fee structures created:', COUNT(*) 
FROM public.fee_structure 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
UNION ALL
SELECT 'Sample payments created:', COUNT(*) 
FROM public.student_fees 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Show class distribution
SELECT 'Class Distribution:' as info;
SELECT 
    c.class_name,
    c.section,
    COUNT(s.id) as student_count,
    COUNT(fs.id) as fee_structure_count
FROM public.classes c
LEFT JOIN public.students s ON c.id = s.class_id
LEFT JOIN public.fee_structure fs ON c.id = fs.class_id
WHERE c.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
GROUP BY c.id, c.class_name, c.section
ORDER BY c.class_name;

-- Show fee structure summary
SELECT 'Fee Structure Summary:' as info;
SELECT 
    fs.fee_component,
    COUNT(*) as classes_with_this_fee,
    AVG(fs.amount) as average_amount,
    MIN(fs.amount) as min_amount,
    MAX(fs.amount) as max_amount
FROM public.fee_structure fs
WHERE fs.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
GROUP BY fs.fee_component
ORDER BY fs.fee_component;

-- Show payment summary
SELECT 'Payment Summary:' as info;
SELECT 
    COUNT(*) as total_payments,
    SUM(amount_paid) as total_amount_collected,
    AVG(amount_paid) as average_payment,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as fully_paid,
    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_payments
FROM public.student_fees
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Success message
SELECT '🎉 Sample fee management data created successfully!' as completion_message;
SELECT '💰 You should now see classes, students, fee structures, and payments in the app!' as final_message;
