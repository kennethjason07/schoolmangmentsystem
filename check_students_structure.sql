-- CHECK STUDENTS TABLE STRUCTURE AND FIX TENANT_ID ISSUES

-- STEP 1: Check students table structure
SELECT 'CHECKING STUDENTS TABLE STRUCTURE...' as status;

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'students'
ORDER BY ordinal_position;

-- STEP 2: Check current tenant_id status in students
SELECT 'CHECKING STUDENTS TENANT_ID STATUS...' as status;

SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- STEP 3: Look at sample students data
SELECT 'SAMPLE STUDENTS DATA...' as status;

SELECT 
    id,
    name,
    email,
    tenant_id,
    class_id
FROM students 
LIMIT 5;

-- STEP 4: Check tenants table
SELECT 'CHECKING TENANTS...' as status;

SELECT id, name, created_at FROM tenants ORDER BY created_at;

-- STEP 5: Check users table structure
SELECT 'CHECKING USERS TABLE STRUCTURE...' as status;

SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users'
ORDER BY ordinal_position;
