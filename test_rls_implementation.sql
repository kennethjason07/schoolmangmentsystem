-- ==========================================
-- RLS IMPLEMENTATION TESTING SCRIPT
-- ==========================================
--
-- Run this script to test that RLS is working correctly
-- Execute each section separately and verify results

-- ==========================================
-- SECTION 1: VERIFY RLS IS ENABLED
-- ==========================================

-- Check that RLS is enabled on key tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'marks', 'student_attendance', 'students', 'teachers', 
    'classes', 'users', 'parents', 'exams', 'subjects'
  )
ORDER BY tablename;

-- Check that policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN (
    'marks', 'student_attendance', 'students', 'teachers', 
    'classes', 'users', 'parents', 'exams', 'subjects'
  )
ORDER BY tablename, policyname;

-- ==========================================
-- SECTION 2: TEST HELPER FUNCTIONS
-- ==========================================

-- Test the RLS helper functions exist and work
SELECT 'Testing RLS helper functions:' as test_section;

-- Test get_current_tenant_id function
SELECT 
  'get_current_tenant_id' as function_name,
  public.get_current_tenant_id() as result,
  CASE 
    WHEN public.get_current_tenant_id() IS NOT NULL 
    THEN 'PASS' 
    ELSE 'FAIL' 
  END as status;

-- Test role checking functions
SELECT 
  'is_admin' as function_name,
  public.is_admin() as result,
  'INFO' as status;

SELECT 
  'is_teacher' as function_name,
  public.is_teacher() as result,
  'INFO' as status;

SELECT 
  'is_parent' as function_name,
  public.is_parent() as result,
  'INFO' as status;

SELECT 
  'is_student' as function_name,
  public.is_student() as result,
  'INFO' as status;

-- ==========================================
-- SECTION 3: TEST TENANT ISOLATION
-- ==========================================

-- Check current user's tenant context
SELECT 'Testing tenant context:' as test_section;

SELECT 
  'current_user_id' as context_item,
  auth.uid() as value;

SELECT 
  'jwt_tenant_id' as context_item,
  auth.jwt() ->> 'tenant_id' as value;

SELECT 
  'database_tenant_id' as context_item,
  (SELECT tenant_id FROM public.users WHERE id = auth.uid())::text as value;

SELECT 
  'rls_function_tenant_id' as context_item,
  public.get_current_tenant_id()::text as value;

-- ==========================================
-- SECTION 4: TEST MARKS TABLE RLS
-- ==========================================

-- Test marks table access (should only see own tenant's data)
SELECT 'Testing marks table RLS:' as test_section;

-- Count total marks accessible (should be limited by tenant)
SELECT 
  'marks_accessible_count' as test_item,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 AND COUNT(*) < 100000 
    THEN 'PASS - Limited access' 
    WHEN COUNT(*) = 0 
    THEN 'INFO - No marks data'
    ELSE 'WARNING - Unrestricted access'
  END as status
FROM public.marks;

-- Check if marks have consistent tenant_id
SELECT 
  'marks_tenant_consistency' as test_item,
  COUNT(DISTINCT tenant_id) as unique_tenants,
  CASE 
    WHEN COUNT(DISTINCT tenant_id) <= 1 
    THEN 'PASS - Single tenant only' 
    ELSE 'FAIL - Multiple tenants visible'
  END as status
FROM public.marks;

-- Sample marks data (first 5 records)
SELECT 
  'sample_marks_data' as test_item,
  json_agg(
    json_build_object(
      'id', id,
      'student_id', student_id,
      'tenant_id', tenant_id,
      'created_at', created_at
    )
  ) as sample_data
FROM (
  SELECT id, student_id, tenant_id, created_at
  FROM public.marks 
  ORDER BY created_at DESC 
  LIMIT 5
) sample;

-- ==========================================
-- SECTION 5: TEST STUDENT_ATTENDANCE TABLE RLS
-- ==========================================

-- Test student_attendance table access
SELECT 'Testing student_attendance table RLS:' as test_section;

-- Count total attendance records accessible
SELECT 
  'attendance_accessible_count' as test_item,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) > 0 AND COUNT(*) < 100000 
    THEN 'PASS - Limited access' 
    WHEN COUNT(*) = 0 
    THEN 'INFO - No attendance data'
    ELSE 'WARNING - Unrestricted access'
  END as status
FROM public.student_attendance;

-- Check attendance tenant consistency
SELECT 
  'attendance_tenant_consistency' as test_item,
  COUNT(DISTINCT tenant_id) as unique_tenants,
  CASE 
    WHEN COUNT(DISTINCT tenant_id) <= 1 
    THEN 'PASS - Single tenant only' 
    ELSE 'FAIL - Multiple tenants visible'
  END as status
FROM public.student_attendance;

-- ==========================================
-- SECTION 6: TEST UNIQUE CONSTRAINTS
-- ==========================================

-- Check that unique constraints include tenant_id
SELECT 'Testing unique constraints:' as test_section;

-- Check student_attendance unique constraint
SELECT 
  'attendance_unique_constraint' as test_item,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
  CASE 
    WHEN string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) LIKE '%tenant_id%'
    THEN 'PASS - Includes tenant_id'
    ELSE 'FAIL - Missing tenant_id'
  END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'student_attendance'
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name;

-- Check marks unique constraint (if it exists)
SELECT 
  'marks_unique_constraint' as test_item,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns,
  CASE 
    WHEN string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) LIKE '%tenant_id%'
    THEN 'PASS - Includes tenant_id'
    ELSE 'FAIL - Missing tenant_id'
  END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'marks'
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name;

-- ==========================================
-- SECTION 7: TEST TRIGGERS
-- ==========================================

-- Check that tenant enforcement triggers exist
SELECT 'Testing triggers:' as test_section;

SELECT 
  'tenant_enforcement_triggers' as test_item,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  CASE 
    WHEN trigger_name LIKE '%enforce_tenant_id%' 
    THEN 'PASS - Tenant trigger exists'
    ELSE 'INFO - Other trigger'
  END as status
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
  AND event_object_table IN ('marks', 'student_attendance', 'students', 'teachers')
  AND trigger_name LIKE '%tenant%'
ORDER BY event_object_table, trigger_name;

-- ==========================================
-- SECTION 8: TEST INSERT WITH RLS
-- ==========================================

-- Test inserting data (should automatically get tenant_id)
SELECT 'Testing RLS insert behavior:' as test_section;

-- Note: This is a read-only test, actual inserts would need to be done 
-- through the application to test trigger behavior

-- Show what would happen with current tenant context
SELECT 
  'insert_simulation' as test_item,
  json_build_object(
    'current_tenant_id', public.get_current_tenant_id(),
    'current_user_id', auth.uid(),
    'would_auto_set_tenant', 
    CASE 
      WHEN public.get_current_tenant_id() IS NOT NULL 
      THEN 'YES - Trigger would set tenant_id'
      ELSE 'NO - No tenant context'
    END
  ) as simulation_result;

-- ==========================================
-- SECTION 9: OVERALL RLS HEALTH CHECK
-- ==========================================

-- Summarize RLS implementation status
SELECT 'RLS Implementation Health Check:' as test_section;

-- Count tables with RLS enabled
WITH rls_summary AS (
  SELECT 
    COUNT(*) FILTER (WHERE rowsecurity = true) as rls_enabled_tables,
    COUNT(*) as total_tables
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN (
      'marks', 'student_attendance', 'students', 'teachers', 
      'classes', 'users', 'parents', 'exams', 'subjects'
    )
),
policy_summary AS (
  SELECT COUNT(DISTINCT tablename) as tables_with_policies
  FROM pg_policies 
  WHERE schemaname = 'public'
),
function_summary AS (
  SELECT COUNT(*) as rls_functions
  FROM pg_proc 
  WHERE proname IN (
    'get_current_tenant_id', 'is_admin', 'is_teacher', 
    'is_parent', 'is_student', 'enforce_tenant_id'
  )
)
SELECT 
  'rls_health_summary' as summary_type,
  json_build_object(
    'rls_enabled_tables', r.rls_enabled_tables,
    'total_tables', r.total_tables,
    'rls_coverage_percent', ROUND((r.rls_enabled_tables::numeric / r.total_tables * 100), 2),
    'tables_with_policies', p.tables_with_policies,
    'rls_helper_functions', f.rls_functions,
    'overall_status', 
    CASE 
      WHEN r.rls_enabled_tables = r.total_tables 
           AND p.tables_with_policies > 0 
           AND f.rls_functions >= 5
      THEN 'HEALTHY - RLS fully implemented'
      WHEN r.rls_enabled_tables > 0 
      THEN 'PARTIAL - RLS partially implemented'
      ELSE 'UNHEALTHY - RLS not implemented'
    END
  ) as health_summary
FROM rls_summary r, policy_summary p, function_summary f;

-- ==========================================
-- SECTION 10: DEBUG JWT CLAIMS
-- ==========================================

-- Test JWT debugging function
SELECT 'Testing JWT claims debugging:' as test_section;

-- Run the debug function to see JWT claim values
SELECT * FROM public.debug_jwt_claims();

-- ==========================================
-- COMPLETION MESSAGE
-- ==========================================

SELECT '===========================================' as message
UNION ALL
SELECT 'RLS TESTING COMPLETED!'
UNION ALL
SELECT '==========================================='
UNION ALL
SELECT 'Review the results above to verify:'
UNION ALL
SELECT '1. RLS is enabled on all tables'
UNION ALL
SELECT '2. Policies exist and are working'
UNION ALL
SELECT '3. Helper functions are available'
UNION ALL
SELECT '4. Tenant isolation is working'
UNION ALL
SELECT '5. Unique constraints include tenant_id'
UNION ALL
SELECT '6. Triggers are in place'
UNION ALL
SELECT '==========================================';

-- Test the main RLS function that summarizes everything
SELECT * FROM public.test_rls_isolation();
