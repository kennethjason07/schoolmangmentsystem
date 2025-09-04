-- Check RLS and Tenant ID Status in Database
-- Run this in Supabase SQL Editor to diagnose current state

-- ==========================================
-- CHECK RLS STATUS ON ALL TABLES
-- ==========================================

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'marks', 'student_attendance', 'students', 'teachers', 
    'classes', 'users', 'parents', 'exams', 'subjects',
    'notifications', 'messages', 'assignments', 'homeworks'
  )
ORDER BY tablename;

-- ==========================================
-- CHECK RLS POLICIES
-- ==========================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ==========================================
-- CHECK TENANT_ID COLUMN STATUS
-- ==========================================

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name = 'tenant_id'
  AND table_name IN (
    'marks', 'student_attendance', 'students', 'teachers', 
    'classes', 'users', 'parents', 'exams', 'subjects'
  )
ORDER BY table_name;

-- ==========================================
-- CHECK UNIQUE CONSTRAINTS ON MARKS TABLE
-- ==========================================

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'marks'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- ==========================================
-- CHECK UNIQUE CONSTRAINTS ON STUDENT_ATTENDANCE
-- ==========================================

SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'student_attendance'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_name, kcu.ordinal_position;

-- ==========================================
-- CHECK TENANTS TABLE CONTENT
-- ==========================================

SELECT 
  id,
  name,
  status,
  created_at,
  max_students,
  max_teachers
FROM public.tenants
ORDER BY created_at;

-- ==========================================
-- CHECK USER TENANT DISTRIBUTION
-- ==========================================

SELECT 
  u.tenant_id,
  t.name as tenant_name,
  r.role_name,
  COUNT(*) as user_count
FROM public.users u
LEFT JOIN public.tenants t ON u.tenant_id = t.id
LEFT JOIN public.roles r ON u.role_id = r.id
GROUP BY u.tenant_id, t.name, r.role_name
ORDER BY u.tenant_id, r.role_name;

-- ==========================================
-- CHECK FOR NULL TENANT_IDS
-- ==========================================

-- Check users with null tenant_id
SELECT 'users' as table_name, COUNT(*) as null_tenant_count
FROM public.users WHERE tenant_id IS NULL
UNION ALL
-- Check students with null tenant_id  
SELECT 'students', COUNT(*) FROM public.students WHERE tenant_id IS NULL
UNION ALL
-- Check teachers with null tenant_id
SELECT 'teachers', COUNT(*) FROM public.teachers WHERE tenant_id IS NULL
UNION ALL
-- Check marks with null tenant_id
SELECT 'marks', COUNT(*) FROM public.marks WHERE tenant_id IS NULL
UNION ALL
-- Check attendance with null tenant_id
SELECT 'student_attendance', COUNT(*) FROM public.student_attendance WHERE tenant_id IS NULL;

-- ==========================================
-- CHECK AUTH CONTEXT FUNCTIONS
-- ==========================================

-- Check if RLS helper functions exist
SELECT 
  proname as function_name,
  pronamespace::regnamespace as schema_name
FROM pg_proc 
WHERE proname IN (
  'get_current_tenant_id',
  'is_admin_in_tenant', 
  'validate_tenant_access',
  'enforce_tenant_id'
)
ORDER BY proname;

-- ==========================================
-- SAMPLE DATA CHECK
-- ==========================================

-- Check recent marks records with tenant info
SELECT 
  m.id,
  m.student_id,
  m.tenant_id,
  s.name as student_name,
  s.tenant_id as student_tenant_id,
  m.created_at
FROM public.marks m
LEFT JOIN public.students s ON m.student_id = s.id
ORDER BY m.created_at DESC
LIMIT 10;
