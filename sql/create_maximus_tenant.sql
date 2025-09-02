-- ===================================================================
-- CREATE MAXIMUS TENANT AND MOVE ALL USERS
-- ===================================================================
-- This script will create a new tenant called "Maximus" and move all users to it

-- Step 1: Create the Maximus tenant
INSERT INTO public.tenants (name, domain, settings) 
VALUES (
  'Maximus', 
  'maximus.school.local',
  jsonb_build_object(
    'created_by_admin', true,
    'creation_date', NOW()::text,
    'school_type', 'primary'
  )
) ON CONFLICT (domain) DO NOTHING;

-- Step 2: Get the Maximus tenant ID and move all data
DO $$
DECLARE
  maximus_tenant_id UUID;
  user_count INTEGER;
  student_count INTEGER;
  teacher_count INTEGER;
  class_count INTEGER;
BEGIN
  -- Get the Maximus tenant ID
  SELECT id INTO maximus_tenant_id 
  FROM public.tenants 
  WHERE name = 'Maximus' 
  LIMIT 1;

  IF maximus_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'Found Maximus tenant with ID: %', maximus_tenant_id;
    
    -- Move all users to Maximus tenant
    UPDATE public.users 
    SET tenant_id = maximus_tenant_id;
    
    GET DIAGNOSTICS user_count = ROW_COUNT;
    RAISE NOTICE 'Moved % users to Maximus tenant', user_count;

    -- Move all students to Maximus tenant
    UPDATE public.students 
    SET tenant_id = maximus_tenant_id;
    
    GET DIAGNOSTICS student_count = ROW_COUNT;
    RAISE NOTICE 'Moved % students to Maximus tenant', student_count;

    -- Move all teachers to Maximus tenant
    UPDATE public.teachers 
    SET tenant_id = maximus_tenant_id;
    
    GET DIAGNOSTICS teacher_count = ROW_COUNT;
    RAISE NOTICE 'Moved % teachers to Maximus tenant', teacher_count;

    -- Move all classes to Maximus tenant
    UPDATE public.classes 
    SET tenant_id = maximus_tenant_id;
    
    GET DIAGNOSTICS class_count = ROW_COUNT;
    RAISE NOTICE 'Moved % classes to Maximus tenant', class_count;

    -- Move all parents to Maximus tenant
    UPDATE public.parents 
    SET tenant_id = maximus_tenant_id;

    -- Move all other related data to Maximus tenant
    UPDATE public.student_attendance 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.teacher_attendance 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.student_fees 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.fee_structure 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.exams 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.marks 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.homeworks 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.subjects 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.teacher_subjects 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.notifications 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.tasks 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.school_details 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.school_expenses 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.student_discounts 
    SET tenant_id = maximus_tenant_id;

    UPDATE public.timetable_entries 
    SET tenant_id = maximus_tenant_id;

    RAISE NOTICE 'All data successfully moved to Maximus tenant!';
    
  ELSE
    RAISE NOTICE 'Error: Could not find or create Maximus tenant';
  END IF;
END $$;

-- Step 3: Update auth users metadata to use Maximus tenant
DO $$
DECLARE
  maximus_tenant_id UUID;
  result JSON;
BEGIN
  -- Get the Maximus tenant ID
  SELECT id INTO maximus_tenant_id 
  FROM public.tenants 
  WHERE name = 'Maximus' 
  LIMIT 1;

  -- Update all existing auth users to use Maximus tenant_id in metadata
  IF maximus_tenant_id IS NOT NULL THEN
    SELECT update_user_tenant_metadata(maximus_tenant_id) INTO result;
    RAISE NOTICE 'Auth metadata update result for Maximus tenant: %', result;
  END IF;
END $$;

-- Step 4: Verification - Show current tenant assignment
SELECT 
  'Verification Results' as status,
  '' as separator;

SELECT 
  'tenants' as table_name, 
  name as tenant_name,
  domain,
  id as tenant_id,
  created_at
FROM public.tenants 
ORDER BY created_at;

SELECT 
  'users_by_tenant' as summary,
  t.name as tenant_name,
  COUNT(u.*) as user_count
FROM public.tenants t
LEFT JOIN public.users u ON t.id = u.tenant_id
GROUP BY t.id, t.name
ORDER BY t.name;

SELECT 
  'students_by_tenant' as summary,
  t.name as tenant_name,
  COUNT(s.*) as student_count
FROM public.tenants t
LEFT JOIN public.students s ON t.id = s.tenant_id
GROUP BY t.id, t.name
ORDER BY t.name;

-- Show sample of users now under Maximus
SELECT 
  'maximus_users' as table_type,
  u.id,
  u.email,
  u.full_name,
  t.name as tenant_name
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE t.name = 'Maximus'
ORDER BY u.email;

-- Final completion message
DO $$
BEGIN
  RAISE NOTICE '=== MAXIMUS TENANT SETUP COMPLETED ===';
  RAISE NOTICE 'All users and data have been moved to Maximus tenant';
  RAISE NOTICE 'Your existing logins should continue to work';
  RAISE NOTICE 'All data is now under the Maximus organization';
END $$;
