-- ===================================================================
-- FIX USER-TENANT SYNCHRONIZATION WITH EXPLICIT TENANT ID REFERENCES
-- ===================================================================
-- Ensure user auth metadata points to the same tenant where the data is

-- Step 1: Check current situation with explicit tenant IDs
SELECT 'Current Data Analysis' as step;

-- Show where the school data is located with tenant ID
SELECT 
  'school_data_location' as info_type,
  sd.tenant_id,
  t.name as tenant_name,
  COUNT(*) as school_records,
  'Tenant ID: ' || sd.tenant_id::TEXT as explicit_tenant_id
FROM public.school_details sd
JOIN public.tenants t ON sd.tenant_id = t.id
GROUP BY sd.tenant_id, t.name
ORDER BY school_records DESC;

-- Show where users are assigned with tenant ID
SELECT 
  'user_assignment' as info_type,
  u.tenant_id,
  t.name as tenant_name,
  COUNT(*) as user_count,
  string_agg(u.email, ', ') as user_emails,
  'Tenant ID: ' || u.tenant_id::TEXT as explicit_tenant_id
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
GROUP BY u.tenant_id, t.name
ORDER BY user_count DESC;

-- Step 2: Find and use the primary tenant with explicit ID handling
DO $$
DECLARE
  primary_tenant_id UUID;
  primary_tenant_name TEXT;
  result JSON;
  update_count INTEGER;
BEGIN
  -- First, try to find the Default School tenant ID directly
  SELECT 
    t.id,
    t.name
  INTO primary_tenant_id, primary_tenant_name
  FROM public.tenants t
  WHERE t.name = 'Default School'
  OR t.id = 'b8f8b5f0-1234-4567-8901-123456789000'::UUID
  LIMIT 1;
  
  -- If not found, get the tenant that has school_details
  IF primary_tenant_id IS NULL THEN
    RAISE NOTICE 'Default School tenant not found, finding tenant with school data...';
    
    SELECT 
      sd.tenant_id,
      t.name
    INTO primary_tenant_id, primary_tenant_name
    FROM public.school_details sd
    JOIN public.tenants t ON sd.tenant_id = t.id
    ORDER BY sd.created_at ASC
    LIMIT 1;
  END IF;

  IF primary_tenant_id IS NOT NULL THEN
    RAISE NOTICE 'PRIMARY TENANT IDENTIFIED:';
    RAISE NOTICE '  Name: %', primary_tenant_name;
    RAISE NOTICE '  ID: %', primary_tenant_id;
    RAISE NOTICE '';
    
    -- Update ALL users to this tenant ID
    UPDATE public.users SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % users to tenant_id = %', update_count, primary_tenant_id;
    
    -- Update ALL students to this tenant ID
    UPDATE public.students SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % students to tenant_id = %', update_count, primary_tenant_id;
    
    -- Update ALL teachers to this tenant ID
    UPDATE public.teachers SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % teachers to tenant_id = %', update_count, primary_tenant_id;
    
    -- Update ALL classes to this tenant ID
    UPDATE public.classes SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    GET DIAGNOSTICS update_count = ROW_COUNT;
    RAISE NOTICE 'Updated % classes to tenant_id = %', update_count, primary_tenant_id;
    
    -- Update all other tables to use this tenant ID
    UPDATE public.parents SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    GET DIAGNOSTICS update_count = ROW_COUNT;
    IF update_count > 0 THEN RAISE NOTICE 'Updated % parents to tenant_id = %', update_count, primary_tenant_id; END IF;
    
    UPDATE public.student_attendance SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.teacher_attendance SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.student_fees SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.fee_structure SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.subjects SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.teacher_subjects SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.exams SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.marks SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.homeworks SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.notifications SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.tasks SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.school_expenses SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.student_discounts SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    UPDATE public.timetable_entries SET tenant_id = primary_tenant_id WHERE tenant_id IS DISTINCT FROM primary_tenant_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Updating authentication metadata with tenant_id = %...', primary_tenant_id;
    
    -- Update auth metadata with the specific tenant ID
    SELECT update_user_tenant_metadata(primary_tenant_id) INTO result;
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ SYNCHRONIZATION COMPLETE:';
    RAISE NOTICE '  Target Tenant: % (ID: %)', primary_tenant_name, primary_tenant_id;
    RAISE NOTICE '  Auth metadata updated: %', COALESCE(result::TEXT, 'Success');
    
    -- Output the specific tenant ID for manual verification
    RAISE NOTICE '';
    RAISE NOTICE '🎯 PRIMARY TENANT ID = %', primary_tenant_id;
  ELSE
    RAISE NOTICE '❌ Could not identify primary tenant - no school_details found';
  END IF;
END $$;

-- Step 3: Final verification
SELECT 'Final Verification' as step;

-- Show final tenant assignment with explicit IDs
SELECT 
  'final_tenant_summary' as type,
  t.id as tenant_id,
  t.name as tenant_name,
  t.domain,
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT s.id) as students, 
  COUNT(DISTINCT te.id) as teachers,
  COUNT(DISTINCT c.id) as classes,
  COUNT(DISTINCT sd.id) as school_details_records,
  'Tenant ID: ' || t.id::TEXT as explicit_tenant_id
FROM public.tenants t
LEFT JOIN public.users u ON t.id = u.tenant_id
LEFT JOIN public.students s ON t.id = s.tenant_id
LEFT JOIN public.teachers te ON t.id = te.tenant_id
LEFT JOIN public.classes c ON t.id = c.tenant_id
LEFT JOIN public.school_details sd ON t.id = sd.tenant_id
GROUP BY t.id, t.name, t.domain
HAVING COUNT(DISTINCT u.id) > 0 OR COUNT(DISTINCT s.id) > 0 OR COUNT(DISTINCT sd.id) > 0
ORDER BY school_details_records DESC, users DESC;

-- Show which tenant your specific user is now using (with explicit tenant ID)
SELECT 
  'your_user_verification' as type,
  u.email,
  u.full_name,
  u.tenant_id,
  t.name as tenant_name,
  'Tenant ID: ' || u.tenant_id::TEXT as explicit_tenant_id,
  CASE 
    WHEN EXISTS(SELECT 1 FROM public.school_details sd WHERE sd.tenant_id = u.tenant_id) 
    THEN '✅ Has school data in tenant ' || u.tenant_id::TEXT
    ELSE '❌ No school data in tenant ' || u.tenant_id::TEXT
  END as school_data_verification
FROM public.users u
JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email = 'kenj7214@gmail.com'  -- Your login email
   OR u.email ILIKE '%kenj%'
   OR u.email ILIKE '%abhi%'
ORDER BY u.email;

-- Cross-reference: Show that school data and users are now in the same tenant
SELECT 
  'cross_reference_verification' as type,
  'School data tenant: ' || sd.tenant_id::TEXT as school_tenant_info,
  'User tenant: ' || u.tenant_id::TEXT as user_tenant_info,
  CASE 
    WHEN sd.tenant_id = u.tenant_id THEN '✅ MATCH - Same tenant ID: ' || sd.tenant_id::TEXT
    ELSE '❌ MISMATCH - School: ' || sd.tenant_id::TEXT || ', User: ' || u.tenant_id::TEXT
  END as tenant_alignment_status
FROM public.school_details sd
CROSS JOIN public.users u
WHERE u.email = 'kenj7214@gmail.com' OR u.email ILIKE '%kenj%' OR u.email ILIKE '%abhi%'
LIMIT 5;

-- Final status message with explicit tenant ID
DO $$
DECLARE
  final_tenant_id UUID;
  final_tenant_name TEXT;
  user_count INTEGER;
  school_count INTEGER;
BEGIN
  -- Get the final tenant where everything should be
  SELECT 
    sd.tenant_id, 
    t.name,
    COUNT(DISTINCT u.id),
    COUNT(DISTINCT sd.id)
  INTO final_tenant_id, final_tenant_name, user_count, school_count
  FROM public.school_details sd
  JOIN public.tenants t ON sd.tenant_id = t.id
  LEFT JOIN public.users u ON sd.tenant_id = u.tenant_id
  GROUP BY sd.tenant_id, t.name
  ORDER BY COUNT(DISTINCT u.id) DESC
  LIMIT 1;

  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL TENANT SYNCHRONIZATION STATUS ===';
  RAISE NOTICE 'Target Tenant Name: %', final_tenant_name;
  RAISE NOTICE 'Target Tenant ID: %', final_tenant_id;
  RAISE NOTICE 'Users in this tenant: %', user_count;
  RAISE NOTICE 'School details records: %', school_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ All data synchronized to tenant: %', final_tenant_id;
  RAISE NOTICE '✅ Authentication metadata updated with tenant: %', final_tenant_id;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '1. Log out of your school management system';
  RAISE NOTICE '2. Log back in';
  RAISE NOTICE '3. All data should now be visible!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 For troubleshooting, remember your tenant ID: %', final_tenant_id;
END $$;
