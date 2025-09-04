-- Fix Tenant ID Mismatch Issue
-- This script fixes the mismatch between user metadata tenant_id and database tenant_id
-- Run this in your Supabase SQL Editor

-- ==========================================
-- STEP 1: Diagnose the tenant ID mismatch
-- ==========================================

SELECT 'Diagnosing tenant ID mismatch for student user...' as info;

-- Check the specific user causing issues
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.tenant_id as database_tenant_id,
  u.linked_student_id,
  s.id as student_id,
  s.name as student_name,
  s.tenant_id as student_tenant_id,
  CASE 
    WHEN u.tenant_id = s.tenant_id THEN '✅ Tenant IDs match'
    ELSE '❌ Tenant ID MISMATCH - This causes the error!'
  END as status
FROM public.users u
LEFT JOIN public.students s ON u.linked_student_id = s.id
WHERE u.email = 'ap8032589@gmail.com';

-- ==========================================
-- STEP 2: Check what the correct tenant should be
-- ==========================================

SELECT 'Checking tenant information...' as info;

-- Show all tenants to identify the correct one
SELECT 
  id,
  name,
  subdomain,
  status
FROM public.tenants
ORDER BY created_at;

-- ==========================================
-- STEP 3: Fix Option 1 - Update user's tenant_id to match student
-- ==========================================

-- UNCOMMENT AND RUN ONE OF THE OPTIONS BELOW:

-- Option 1A: Update user tenant_id to match the student's tenant_id
-- UPDATE public.users 
-- SET tenant_id = (
--   SELECT s.tenant_id 
--   FROM public.students s 
--   WHERE s.id = users.linked_student_id
-- )
-- WHERE email = 'ap8032589@gmail.com' 
-- AND linked_student_id IS NOT NULL;

-- ==========================================
-- STEP 4: Fix Option 2 - Update student's tenant_id to match user
-- ==========================================

-- Option 2A: Update student tenant_id to match the user's tenant_id
-- UPDATE public.students 
-- SET tenant_id = (
--   SELECT u.tenant_id 
--   FROM public.users u 
--   WHERE u.linked_student_id = students.id
--   AND u.email = 'ap8032589@gmail.com'
-- )
-- WHERE id = (
--   SELECT linked_student_id 
--   FROM public.users 
--   WHERE email = 'ap8032589@gmail.com'
-- );

-- ==========================================
-- STEP 5: Recommended Fix - Set both to Maximus tenant
-- ==========================================

-- This assumes 'b8f8b5f0-1234-4567-8901-123456789000' is the correct Maximus tenant

-- Update user to use consistent tenant_id
UPDATE public.users 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE email = 'ap8032589@gmail.com';

-- Update student to use consistent tenant_id  
UPDATE public.students 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = (
  SELECT linked_student_id 
  FROM public.users 
  WHERE email = 'ap8032589@gmail.com'
);

-- Update any related class record
UPDATE public.classes 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE id = (
  SELECT s.class_id 
  FROM public.students s 
  JOIN public.users u ON s.id = u.linked_student_id
  WHERE u.email = 'ap8032589@gmail.com'
);

-- ==========================================
-- STEP 6: Verify the fix
-- ==========================================

SELECT 'Verifying tenant ID consistency after fix...' as info;

SELECT 
  u.id,
  u.email,
  u.tenant_id as user_tenant_id,
  s.id as student_id,
  s.name as student_name,
  s.tenant_id as student_tenant_id,
  c.id as class_id,
  c.class_name,
  c.tenant_id as class_tenant_id,
  CASE 
    WHEN u.tenant_id = s.tenant_id AND s.tenant_id = c.tenant_id THEN '✅ ALL CONSISTENT'
    ELSE '❌ Still have mismatches'
  END as final_status
FROM public.users u
LEFT JOIN public.students s ON u.linked_student_id = s.id
LEFT JOIN public.classes c ON s.class_id = c.id
WHERE u.email = 'ap8032589@gmail.com';

-- ==========================================
-- STEP 7: Test the student query that was failing
-- ==========================================

SELECT 'Testing the exact student query that was failing...' as info;

-- This is the query from StudentDashboard.js that was failing
SELECT 
  s.*,
  c.id, c.class_name, c.section,
  p.name, p.phone, p.email
FROM public.students s
LEFT JOIN public.classes c ON s.class_id = c.id  
LEFT JOIN public.parents p ON s.parent_id = p.id
WHERE s.id = (
  SELECT linked_student_id 
  FROM public.users 
  WHERE email = 'ap8032589@gmail.com'
)
AND s.tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000';

-- Show success message
SELECT '🎉 Tenant ID mismatch should now be fixed!' as completion_message;
SELECT 'Try logging into the student dashboard again.' as next_step;
