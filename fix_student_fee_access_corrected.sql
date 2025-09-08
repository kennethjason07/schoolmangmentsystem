-- ========================================
-- CORRECTED STUDENT FEE ACCESS FIX SCRIPT
-- ========================================
-- This script diagnoses and fixes all student fee payment screen issues
-- Uses correct column names based on actual database schema

DO $$
DECLARE
    current_user_id UUID;
    current_user_email TEXT;
    target_tenant_id UUID;
    target_student_id UUID;
    target_class_id UUID;
    user_count INTEGER;
    tenant_count INTEGER;
    student_count INTEGER;
    class_count INTEGER;
    fee_structure_count INTEGER;
    student_fee_count INTEGER;
BEGIN
    -- =========================
    -- STEP 1: DIAGNOSTIC PHASE
    -- =========================
    
    RAISE NOTICE '🔍 STARTING COMPREHENSIVE STUDENT FEE ACCESS DIAGNOSIS...';
    RAISE NOTICE '';
    
    -- Get current authenticated user info
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE '❌ No authenticated user found. You must be logged in.';
        RETURN;
    END IF;
    
    RAISE NOTICE '👤 Current authenticated user ID: %', current_user_id;
    
    -- Get user email from auth metadata if available
    SELECT email INTO current_user_email FROM auth.users WHERE id = current_user_id;
    RAISE NOTICE '📧 Current user email: %', COALESCE(current_user_email, 'Not found');
    
    -- Check if user exists in users table
    SELECT COUNT(*) INTO user_count FROM public.users WHERE id = current_user_id;
    RAISE NOTICE '📊 User exists in users table: %', CASE WHEN user_count > 0 THEN 'YES' ELSE 'NO' END;
    
    -- Get user's tenant_id if exists
    SELECT tenant_id INTO target_tenant_id FROM public.users WHERE id = current_user_id LIMIT 1;
    RAISE NOTICE '🏢 User''s current tenant_id: %', COALESCE(target_tenant_id::TEXT, 'NOT SET');
    
    -- Count available tenants
    SELECT COUNT(*) INTO tenant_count FROM public.tenants WHERE status = 'active';
    RAISE NOTICE '📊 Available active tenants: %', tenant_count;
    
    -- Count students
    SELECT COUNT(*) INTO student_count FROM public.students;
    RAISE NOTICE '👥 Total students in database: %', student_count;
    
    -- Count classes
    SELECT COUNT(*) INTO class_count FROM public.classes;
    RAISE NOTICE '🏫 Total classes in database: %', class_count;
    
    -- Count fee structures
    SELECT COUNT(*) INTO fee_structure_count FROM public.fee_structure;
    RAISE NOTICE '💰 Total fee structures in database: %', fee_structure_count;
    
    -- Count student fees
    SELECT COUNT(*) INTO student_fee_count FROM public.student_fees;
    RAISE NOTICE '🧾 Total student fee records in database: %', student_fee_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== AVAILABLE DATA OVERVIEW ===';
    
    -- Show available tenants
    RAISE NOTICE '🏢 Available tenants:';
    FOR rec IN (SELECT id, name, subdomain, status FROM public.tenants ORDER BY name LIMIT 5) LOOP
        RAISE NOTICE '   - % (%) - % [%]', rec.name, rec.subdomain, rec.id, rec.status;
    END LOOP;
    
    -- Show available students
    IF student_count > 0 THEN
        RAISE NOTICE '👥 Sample students:';
        FOR rec IN (SELECT id, name, admission_no, class_id, tenant_id FROM public.students ORDER BY name LIMIT 5) LOOP
            RAISE NOTICE '   - % (%) - Class: %, Tenant: %', rec.name, rec.admission_no, COALESCE(rec.class_id::TEXT, 'NULL'), COALESCE(rec.tenant_id::TEXT, 'NULL');
        END LOOP;
    ELSE
        RAISE NOTICE '⚠️ No students found in database';
    END IF;
    
    -- =========================
    -- STEP 2: AUTO-FIX PHASE
    -- =========================
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 STARTING AUTO-FIX PROCESS...';
    
    -- Fix 1: If no tenant is set for user, assign first active tenant
    IF target_tenant_id IS NULL THEN
        SELECT id INTO target_tenant_id FROM public.tenants WHERE status = 'active' ORDER BY created_at LIMIT 1;
        
        IF target_tenant_id IS NOT NULL THEN
            -- Insert or update user record with tenant
            INSERT INTO public.users (id, email, tenant_id, created_at, updated_at) 
            VALUES (current_user_id, current_user_email, target_tenant_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                tenant_id = target_tenant_id,
                updated_at = NOW();
            
            RAISE NOTICE '✅ Assigned user to tenant: %', target_tenant_id;
        ELSE
            -- Create a new tenant
            target_tenant_id := gen_random_uuid();
            INSERT INTO public.tenants (id, name, subdomain, status, contact_email, created_at, updated_at)
            VALUES (target_tenant_id, 'Default School', 'default', 'active', current_user_email, NOW(), NOW());
            
            -- Update user with new tenant
            INSERT INTO public.users (id, email, tenant_id, created_at, updated_at) 
            VALUES (current_user_id, current_user_email, target_tenant_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                tenant_id = target_tenant_id,
                updated_at = NOW();
            
            RAISE NOTICE '✅ Created new tenant and assigned user: %', target_tenant_id;
        END IF;
    END IF;
    
    -- Fix 2: Ensure we have at least one class for this tenant
    SELECT id INTO target_class_id FROM public.classes WHERE tenant_id = target_tenant_id ORDER BY created_at LIMIT 1;
    
    IF target_class_id IS NULL THEN
        target_class_id := gen_random_uuid();
        INSERT INTO public.classes (id, class_name, section, academic_year, tenant_id, created_at, updated_at)
        VALUES (target_class_id, '10th Grade', 'A', '2024-2025', target_tenant_id, NOW(), NOW());
        
        RAISE NOTICE '✅ Created sample class: %', target_class_id;
    END IF;
    
    -- Fix 3: Ensure we have at least one student for this tenant
    SELECT id INTO target_student_id FROM public.students WHERE tenant_id = target_tenant_id ORDER BY created_at LIMIT 1;
    
    IF target_student_id IS NULL THEN
        target_student_id := gen_random_uuid();
        INSERT INTO public.students (id, admission_no, name, dob, gender, academic_year, class_id, tenant_id, created_at, updated_at)
        VALUES (target_student_id, 'STU001', 'Sample Student', '2005-01-01', 'Male', '2024-2025', target_class_id, target_tenant_id, NOW(), NOW());
        
        RAISE NOTICE '✅ Created sample student: %', target_student_id;
    END IF;
    
    -- Fix 4: Create sample fee structures if none exist
    SELECT COUNT(*) INTO fee_structure_count FROM public.fee_structure WHERE tenant_id = target_tenant_id;
    
    IF fee_structure_count = 0 THEN
        INSERT INTO public.fee_structure (id, fee_component, amount, base_amount, academic_year, class_id, tenant_id, due_date, created_at)
        VALUES 
        (gen_random_uuid(), 'Tuition Fee', 5000, 5000, '2024-2025', target_class_id, target_tenant_id, '2025-04-30', NOW()),
        (gen_random_uuid(), 'Books Fee', 1500, 1500, '2024-2025', target_class_id, target_tenant_id, '2025-05-15', NOW()),
        (gen_random_uuid(), 'Transport Fee', 2000, 2000, '2024-2025', target_class_id, target_tenant_id, '2025-05-30', NOW());
        
        RAISE NOTICE '✅ Created 3 sample fee structures';
    ELSE
        RAISE NOTICE '✅ Fee structures already exist (%)', fee_structure_count;
    END IF;
    
    -- Fix 5: Create sample student fee records if none exist
    SELECT COUNT(*) INTO student_fee_count FROM public.student_fees WHERE tenant_id = target_tenant_id;
    
    IF student_fee_count = 0 THEN
        INSERT INTO public.student_fees (id, student_id, academic_year, fee_component, amount_paid, payment_date, payment_mode, tenant_id, created_at)
        VALUES 
        (gen_random_uuid(), target_student_id, '2024-2025', 'Tuition Fee', 2500, '2025-01-15', 'Online', target_tenant_id, NOW()),
        (gen_random_uuid(), target_student_id, '2024-2025', 'Books Fee', 1500, '2025-01-20', 'Cash', target_tenant_id, NOW());
        
        RAISE NOTICE '✅ Created 2 sample student fee records';
    ELSE
        RAISE NOTICE '✅ Student fee records already exist (%)', student_fee_count;
    END IF;
    
    -- =========================
    -- STEP 3: VERIFICATION PHASE
    -- =========================
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ VERIFICATION OF FIXES...';
    
    -- Verify user mapping
    SELECT u.email, u.tenant_id, t.name as tenant_name
    INTO rec
    FROM public.users u 
    LEFT JOIN public.tenants t ON u.tenant_id = t.id 
    WHERE u.id = current_user_id;
    
    IF rec IS NOT NULL THEN
        RAISE NOTICE '👤 User mapping verified: % → % (%)', rec.email, rec.tenant_name, rec.tenant_id;
    END IF;
    
    -- Show final data counts for this tenant
    SELECT 
        (SELECT COUNT(*) FROM public.students WHERE tenant_id = target_tenant_id) as students,
        (SELECT COUNT(*) FROM public.classes WHERE tenant_id = target_tenant_id) as classes,
        (SELECT COUNT(*) FROM public.fee_structure WHERE tenant_id = target_tenant_id) as fee_structures,
        (SELECT COUNT(*) FROM public.student_fees WHERE tenant_id = target_tenant_id) as student_fees
    INTO rec;
    
    RAISE NOTICE '📊 Final counts for tenant %:', target_tenant_id;
    RAISE NOTICE '   - Students: %', rec.students;
    RAISE NOTICE '   - Classes: %', rec.classes;
    RAISE NOTICE '   - Fee Structures: %', rec.fee_structures;
    RAISE NOTICE '   - Student Fees: %', rec.student_fees;
    
    -- =========================
    -- STEP 4: RLS POLICY SETUP
    -- =========================
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 SETTING UP RLS POLICIES...';
    
    -- Enable RLS on all tables
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.fee_structure ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies (ignore errors)
    DROP POLICY IF EXISTS users_access ON public.users;
    DROP POLICY IF EXISTS tenants_access ON public.tenants;
    DROP POLICY IF EXISTS students_access ON public.students;
    DROP POLICY IF EXISTS classes_access ON public.classes;
    DROP POLICY IF EXISTS fee_structure_access ON public.fee_structure;
    DROP POLICY IF EXISTS student_fees_access ON public.student_fees;
    
    -- Create permissive policies that allow access to user's tenant data
    CREATE POLICY users_access ON public.users
    FOR ALL TO authenticated
    USING (id = auth.uid() OR tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    CREATE POLICY tenants_access ON public.tenants
    FOR ALL TO authenticated  
    USING (id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    CREATE POLICY students_access ON public.students
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    CREATE POLICY classes_access ON public.classes
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    CREATE POLICY fee_structure_access ON public.fee_structure
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    CREATE POLICY student_fees_access ON public.student_fees
    FOR ALL TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
    
    RAISE NOTICE '✅ RLS policies configured successfully';
    
    -- Grant permissions to authenticated role
    GRANT ALL ON public.users TO authenticated;
    GRANT ALL ON public.tenants TO authenticated; 
    GRANT ALL ON public.students TO authenticated;
    GRANT ALL ON public.classes TO authenticated;
    GRANT ALL ON public.fee_structure TO authenticated;
    GRANT ALL ON public.student_fees TO authenticated;
    
    RAISE NOTICE '✅ Permissions granted to authenticated role';
    
    -- =========================
    -- FINAL SUCCESS MESSAGE
    -- =========================
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ============================================';
    RAISE NOTICE '🎉 STUDENT FEE ACCESS FIX COMPLETED!';
    RAISE NOTICE '🎉 ============================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Current user is now properly linked to tenant: %', target_tenant_id;
    RAISE NOTICE '✅ Sample data has been created if it was missing';
    RAISE NOTICE '✅ RLS policies are configured for secure access';
    RAISE NOTICE '✅ Your student fee payment screen should now work!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 KEY INFO FOR YOUR APP:';
    RAISE NOTICE '   - User ID: %', current_user_id;
    RAISE NOTICE '   - Tenant ID: %', target_tenant_id;
    RAISE NOTICE '   - Student ID: %', target_student_id;
    RAISE NOTICE '   - Class ID: %', target_class_id;
    RAISE NOTICE '';
    RAISE NOTICE '📱 Test your student fee payment screen now!';

END $$;

-- Clean up any temporary debug tables
DROP TABLE IF EXISTS debug_current_user;
DROP TABLE IF EXISTS debug_tenant_mapping;
DROP TABLE IF EXISTS debug_student_data;

-- Show final verification query
SELECT '🔍 Final verification - Students accessible to current user:' as info;

SELECT 
    s.id,
    s.name,
    s.admission_no,
    c.class_name,
    c.section,
    COUNT(sf.id) as fee_payments,
    COUNT(DISTINCT fs.id) as available_fees
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id
LEFT JOIN public.student_fees sf ON s.id = sf.student_id
LEFT JOIN public.fee_structure fs ON c.id = fs.class_id
WHERE s.tenant_id IN (SELECT tenant_id FROM public.users WHERE id = auth.uid())
GROUP BY s.id, s.name, s.admission_no, c.class_name, c.section
ORDER BY s.name
LIMIT 10;
