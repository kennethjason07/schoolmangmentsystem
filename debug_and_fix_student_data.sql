-- Debug and Fix Student Data Access Issues
-- This script diagnoses missing data and user setup problems

BEGIN;

-- ===============================================
-- 1. SHOW CURRENT USER AUTH STATUS
-- ===============================================
SELECT 'CURRENT AUTH USER DEBUG' as section;

-- Show current authenticated user (if any)
SELECT 
  auth.uid() as current_auth_user_id,
  auth.email() as current_auth_email,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NO AUTHENTICATED USER - LOGIN REQUIRED'
    ELSE 'AUTHENTICATED USER FOUND'
  END as auth_status;

-- ===============================================
-- 2. SHOW ALL USERS IN DATABASE
-- ===============================================
SELECT 'ALL USERS IN DATABASE' as section;

SELECT 
  id,
  email,
  full_name,
  tenant_id,
  role_id,
  linked_student_id,
  created_at
FROM public.users
ORDER BY created_at DESC;

-- ===============================================
-- 3. SHOW ALL TENANTS  
-- ===============================================
SELECT 'ALL TENANTS IN DATABASE' as section;

SELECT 
  id,
  name,
  subdomain,
  status,
  created_at
FROM public.tenants
ORDER BY created_at DESC;

-- ===============================================
-- 4. SHOW ALL STUDENTS
-- ===============================================
SELECT 'ALL STUDENTS IN DATABASE' as section;

SELECT 
  id,
  name,
  email,
  class_id,
  tenant_id,
  created_at
FROM public.students
ORDER BY created_at DESC
LIMIT 10;

-- ===============================================
-- 5. CHECK FEE-RELATED TABLES
-- ===============================================
SELECT 'FEE STRUCTURE DATA' as section;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        RAISE NOTICE 'fee_structure table exists';
        
        -- Show fee structure records
        FOR i IN (SELECT id, name, amount, tenant_id FROM public.fee_structure LIMIT 5)
        LOOP
            RAISE NOTICE 'Fee: % - Amount: % - Tenant: %', i.name, i.amount, i.tenant_id;
        END LOOP;
    ELSE
        RAISE NOTICE 'fee_structure table does NOT exist - this might be the problem!';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_payments') THEN
        RAISE NOTICE 'fee_payments table exists';
        
        -- Show fee payment records
        FOR i IN (SELECT id, student_id, amount, tenant_id FROM public.fee_payments LIMIT 5)
        LOOP
            RAISE NOTICE 'Payment: Student % - Amount: % - Tenant: %', i.student_id, i.amount, i.tenant_id;
        END LOOP;
    ELSE
        RAISE NOTICE 'fee_payments table does NOT exist';
    END IF;
END $$;

-- ===============================================
-- 6. CREATE MISSING TENANT IF NEEDED
-- ===============================================
INSERT INTO public.tenants (id, name, subdomain, status, contact_email, created_at)
VALUES (
  'b8f8b5f0-1234-4567-8901-123456789000',
  'Test School',
  'testschool',
  'active',
  'admin@testschool.com',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  status = 'active',
  name = EXCLUDED.name;

-- ===============================================
-- 7. CREATE SAMPLE STUDENT IF NEEDED
-- ===============================================
INSERT INTO public.students (id, name, email, class_id, tenant_id, roll_no, admission_no, created_at)
VALUES (
  'student-001-test-uuid',
  'Test Student',
  'student@testschool.com',
  'class-001-test-uuid',
  'b8f8b5f0-1234-4567-8901-123456789000',
  '001',
  'ADM001',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name;

-- Create sample class if needed
INSERT INTO public.classes (id, class_name, section, tenant_id, academic_year, created_at)
VALUES (
  'class-001-test-uuid',
  'Class 10',
  'A',
  'b8f8b5f0-1234-4567-8901-123456789000',
  '2024-2025',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ===============================================
-- 8. CREATE SAMPLE FEE STRUCTURE IF TABLE EXISTS
-- ===============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fee_structure') THEN
        -- Create sample fee structure
        INSERT INTO public.fee_structure (id, name, amount, tenant_id, class_id, fee_type, due_date, created_at)
        VALUES 
          (
            'fee-001-tuition',
            'Tuition Fee',
            5000,
            'b8f8b5f0-1234-4567-8901-123456789000',
            'class-001-test-uuid',
            'tuition',
            NOW() + INTERVAL '30 days',
            NOW()
          ),
          (
            'fee-002-books',
            'Books Fee',
            1500,
            'b8f8b5f0-1234-4567-8901-123456789000',
            'class-001-test-uuid',
            'books',
            NOW() + INTERVAL '30 days',
            NOW()
          )
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Sample fee structure created';
    ELSE
        RAISE NOTICE 'fee_structure table does not exist - cannot create sample data';
    END IF;
END $$;

-- ===============================================
-- 9. FIX/CREATE USER RECORD FOR CURRENT AUTH USER
-- ===============================================
DO $$
DECLARE
    current_user_email TEXT;
    current_user_id UUID;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    current_user_email := auth.email();
    
    IF current_user_id IS NOT NULL AND current_user_email IS NOT NULL THEN
        RAISE NOTICE 'Current authenticated user: % (ID: %)', current_user_email, current_user_id;
        
        -- Insert or update user record
        INSERT INTO public.users (
            id, 
            email, 
            tenant_id, 
            role_id, 
            linked_student_id,
            full_name,
            created_at
        )
        VALUES (
            current_user_id,
            current_user_email,
            'b8f8b5f0-1234-4567-8901-123456789000',
            4, -- Student role
            'student-001-test-uuid',
            split_part(current_user_email, '@', 1), -- Use email prefix as name
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            role_id = EXCLUDED.role_id,
            linked_student_id = EXCLUDED.linked_student_id,
            full_name = COALESCE(users.full_name, EXCLUDED.full_name);
        
        RAISE NOTICE 'User record created/updated for current authenticated user';
    ELSE
        RAISE NOTICE 'No authenticated user found - cannot create user record';
    END IF;
END $$;

-- ===============================================
-- 10. SHOW FINAL STATUS
-- ===============================================
SELECT 'FINAL USER STATUS CHECK' as section;

-- Show user-tenant-student linkage
SELECT 
  u.email as user_email,
  u.tenant_id as user_tenant,
  t.name as tenant_name,
  t.status as tenant_status,
  u.linked_student_id,
  s.name as student_name,
  s.tenant_id as student_tenant
FROM public.users u
LEFT JOIN public.tenants t ON u.tenant_id = t.id
LEFT JOIN public.students s ON u.linked_student_id = s.id
WHERE u.id = auth.uid() OR u.email = auth.email();

-- ===============================================
-- 11. SHOW TABLE STRUCTURES FOR DEBUGGING
-- ===============================================
SELECT 'TABLE STRUCTURE DEBUG' as section;

-- Show which fee-related tables exist
SELECT 
  table_name,
  CASE WHEN table_name IN (
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  ) THEN 'EXISTS' ELSE 'MISSING' END as status
FROM (VALUES 
  ('fee_structure'),
  ('fee_payments'), 
  ('student_fee_structure'),
  ('fee_components')
) t(table_name);

COMMIT;

-- Final success message
SELECT 
  'DEBUG COMPLETE!' as status,
  'Check the output above to see what data was found/created' as message,
  'Now try the student fee screen again' as next_step;
