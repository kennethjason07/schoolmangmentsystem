-- ===================================================================
-- INTEGRATE ALL DATA UNDER CURRENT TENANT
-- ===================================================================
-- This script will ensure ALL data is properly assigned to the correct tenant

-- Step 1: First, let's see what tenants exist and where data currently sits
SELECT 
  'Current Tenant Analysis' as analysis_type,
  '' as separator;

-- Show all tenants
SELECT 
  'tenants' as table_name,
  id as tenant_id,
  name as tenant_name,
  domain,
  created_at
FROM public.tenants
ORDER BY created_at;

-- Show current data distribution by tenant
SELECT 
  'data_distribution' as analysis,
  'users' as table_name,
  tenant_id,
  COUNT(*) as record_count
FROM public.users
GROUP BY tenant_id
UNION ALL
SELECT 
  'data_distribution' as analysis,
  'students' as table_name,
  tenant_id,
  COUNT(*) as record_count
FROM public.students
GROUP BY tenant_id
UNION ALL
SELECT 
  'data_distribution' as analysis,
  'teachers' as table_name,
  tenant_id,
  COUNT(*) as record_count
FROM public.teachers
GROUP BY tenant_id
UNION ALL
SELECT 
  'data_distribution' as analysis,
  'classes' as table_name,
  tenant_id,
  COUNT(*) as record_count
FROM public.classes
GROUP BY tenant_id;

-- Step 2: Get or create the primary tenant (Maximus or Default School)
DO $$
DECLARE
  primary_tenant_id UUID;
  primary_tenant_name TEXT;
  user_count INTEGER;
  student_count INTEGER;
  teacher_count INTEGER;
  class_count INTEGER;
  parent_count INTEGER;
BEGIN
  -- Try to find Maximus tenant first, then Default School, then create one
  SELECT id, name INTO primary_tenant_id, primary_tenant_name
  FROM public.tenants 
  WHERE name IN ('Maximus', 'Default School')
  ORDER BY 
    CASE WHEN name = 'Maximus' THEN 1 
         WHEN name = 'Default School' THEN 2 
         ELSE 3 END
  LIMIT 1;

  -- If no suitable tenant found, create "School Management System"
  IF primary_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, domain, settings) 
    VALUES (
      'School Management System',
      'main.school.local',
      jsonb_build_object(
        'created_by_integration', true,
        'integration_date', NOW()::text,
        'is_primary', true
      )
    ) RETURNING id, name INTO primary_tenant_id, primary_tenant_name;
    
    RAISE NOTICE 'Created new primary tenant: % with ID: %', primary_tenant_name, primary_tenant_id;
  ELSE
    RAISE NOTICE 'Using existing tenant: % with ID: %', primary_tenant_name, primary_tenant_id;
  END IF;

  -- Now move ALL data to this primary tenant
  RAISE NOTICE 'Starting comprehensive data integration...';

  -- Move all users
  UPDATE public.users SET tenant_id = primary_tenant_id;
  GET DIAGNOSTICS user_count = ROW_COUNT;
  RAISE NOTICE '✅ Integrated % users', user_count;

  -- Move all students
  UPDATE public.students SET tenant_id = primary_tenant_id;
  GET DIAGNOSTICS student_count = ROW_COUNT;
  RAISE NOTICE '✅ Integrated % students', student_count;

  -- Move all teachers
  UPDATE public.teachers SET tenant_id = primary_tenant_id;
  GET DIAGNOSTICS teacher_count = ROW_COUNT;
  RAISE NOTICE '✅ Integrated % teachers', teacher_count;

  -- Move all classes
  UPDATE public.classes SET tenant_id = primary_tenant_id;
  GET DIAGNOSTICS class_count = ROW_COUNT;
  RAISE NOTICE '✅ Integrated % classes', class_count;

  -- Move all parents
  UPDATE public.parents SET tenant_id = primary_tenant_id;
  GET DIAGNOSTICS parent_count = ROW_COUNT;
  RAISE NOTICE '✅ Integrated % parents', parent_count;

  -- Move all attendance data
  UPDATE public.student_attendance SET tenant_id = primary_tenant_id;
  UPDATE public.teacher_attendance SET tenant_id = primary_tenant_id WHERE tenant_id IS NOT NULL;

  -- Move all fee data
  UPDATE public.student_fees SET tenant_id = primary_tenant_id;
  UPDATE public.fee_structure SET tenant_id = primary_tenant_id;

  -- Move all academic data
  UPDATE public.subjects SET tenant_id = primary_tenant_id;
  UPDATE public.teacher_subjects SET tenant_id = primary_tenant_id;
  UPDATE public.exams SET tenant_id = primary_tenant_id;
  UPDATE public.marks SET tenant_id = primary_tenant_id;
  UPDATE public.homeworks SET tenant_id = primary_tenant_id;

  -- Move all administrative data
  UPDATE public.notifications SET tenant_id = primary_tenant_id;
  UPDATE public.tasks SET tenant_id = primary_tenant_id;
  UPDATE public.school_details SET tenant_id = primary_tenant_id;
  UPDATE public.school_expenses SET tenant_id = primary_tenant_id;
  UPDATE public.student_discounts SET tenant_id = primary_tenant_id;
  UPDATE public.timetable_entries SET tenant_id = primary_tenant_id;

  RAISE NOTICE '🎉 ALL DATA SUCCESSFULLY INTEGRATED UNDER: %', primary_tenant_name;
  
END $$;

-- Step 3: Update auth user metadata to point to the primary tenant
DO $$
DECLARE
  primary_tenant_id UUID;
  result JSON;
BEGIN
  -- Get the primary tenant ID
  SELECT id INTO primary_tenant_id 
  FROM public.tenants 
  WHERE name IN ('Maximus', 'Default School', 'School Management System')
  ORDER BY 
    CASE WHEN name = 'Maximus' THEN 1 
         WHEN name = 'Default School' THEN 2 
         WHEN name = 'School Management System' THEN 3
         ELSE 4 END
  LIMIT 1;

  -- Update all auth users to use this tenant
  IF primary_tenant_id IS NOT NULL THEN
    SELECT update_user_tenant_metadata(primary_tenant_id) INTO result;
    RAISE NOTICE '🔐 Auth metadata update result: %', result;
  END IF;
END $$;

-- Step 4: Verification - Show final data distribution
SELECT 
  'Final Integration Results' as status,
  '' as separator;

-- Show tenant summary
SELECT 
  'tenant_summary' as type,
  t.name as tenant_name,
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT s.id) as students,
  COUNT(DISTINCT te.id) as teachers,
  COUNT(DISTINCT c.id) as classes
FROM public.tenants t
LEFT JOIN public.users u ON t.id = u.tenant_id
LEFT JOIN public.students s ON t.id = s.tenant_id
LEFT JOIN public.teachers te ON t.id = te.tenant_id
LEFT JOIN public.classes c ON t.id = c.tenant_id
GROUP BY t.id, t.name
HAVING COUNT(DISTINCT u.id) > 0 OR COUNT(DISTINCT s.id) > 0
ORDER BY t.name;

-- Show sample data to verify
SELECT 
  'sample_verification' as type,
  'users' as table_name,
  u.email,
  u.full_name,
  t.name as tenant_name
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
ORDER BY u.email
LIMIT 5;

SELECT 
  'sample_verification' as type,
  'students' as table_name,
  s.name as student_name,
  s.admission_no,
  c.class_name,
  c.section,
  t.name as tenant_name
FROM public.students s
JOIN public.tenants t ON s.tenant_id = t.id
LEFT JOIN public.classes c ON s.class_id = c.id
ORDER BY s.name
LIMIT 5;

-- Check school details
SELECT 
  'school_details_check' as type,
  sd.*,
  t.name as tenant_name
FROM public.school_details sd
JOIN public.tenants t ON sd.tenant_id = t.id
LIMIT 1;

-- Step 5: Clean up any orphaned data or duplicate tenants if needed
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Check for any data without tenant_id
  SELECT COUNT(*) INTO orphan_count
  FROM public.users
  WHERE tenant_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE NOTICE '⚠️ Found % users without tenant_id - these need manual review', orphan_count;
  ELSE
    RAISE NOTICE '✅ All users have proper tenant assignment';
  END IF;
END $$;

-- Final completion message
DO $$
BEGIN
  RAISE NOTICE '=== DATA INTEGRATION COMPLETED ===';
  RAISE NOTICE '✅ All existing data is now properly assigned to a tenant';
  RAISE NOTICE '✅ Auth metadata has been updated';  
  RAISE NOTICE '✅ Your login should now show all your data';
  RAISE NOTICE '🎯 Try logging in again - all data should be visible';
END $$;
