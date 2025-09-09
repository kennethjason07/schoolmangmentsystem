-- Simple Student Data Debug Script
-- This checks what actually exists in your database

-- ===============================================
-- 1. CHECK CURRENT AUTHENTICATED USER
-- ===============================================
SELECT 
  'CURRENT USER' as section,
  auth.uid() as auth_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NOT LOGGED IN'
    ELSE 'LOGGED IN'
  END as status;

-- ===============================================
-- 2. CHECK USERS TABLE STRUCTURE AND DATA
-- ===============================================
SELECT 'USERS TABLE COLUMNS' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'USERS TABLE DATA' as section;
SELECT * FROM public.users ORDER BY created_at DESC LIMIT 5;

-- ===============================================
-- 3. CHECK TENANTS TABLE
-- ===============================================
SELECT 'TENANTS TABLE DATA' as section;
SELECT id, name, status, created_at FROM public.tenants ORDER BY created_at DESC;

-- ===============================================
-- 4. CHECK STUDENTS TABLE STRUCTURE AND DATA  
-- ===============================================
SELECT 'STUDENTS TABLE COLUMNS' as section;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'students' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'STUDENTS TABLE DATA' as section;
SELECT * FROM public.students ORDER BY created_at DESC LIMIT 5;

-- ===============================================
-- 5. CHECK WHICH FEE TABLES EXIST
-- ===============================================
SELECT 'FEE TABLES CHECK' as section;
SELECT 
  t.table_name,
  CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END as status
FROM information_schema.tables t
WHERE t.table_schema = 'public' 
  AND t.table_name LIKE '%fee%'
ORDER BY t.table_name;

-- ===============================================
-- 6. CHECK CLASSES TABLE
-- ===============================================
SELECT 'CLASSES TABLE DATA' as section;
SELECT * FROM public.classes ORDER BY created_at DESC LIMIT 3;

-- ===============================================
-- 7. SHOW ALL AVAILABLE TABLES
-- ===============================================
SELECT 'ALL TABLES IN DATABASE' as section;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
