-- ================================================================
-- CHECK CURRENT ATTENDANCE CONSTRAINTS STATUS
-- ================================================================
-- This script checks the current state of the student_attendance table
-- to understand what constraints and columns exist

\echo '🔍 CHECKING CURRENT STUDENT_ATTENDANCE TABLE STATUS...'

-- Check if student_attendance table exists
SELECT 
    'Table Existence' as check_type,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'student_attendance'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status;

-- Check current table structure
\echo '📋 CURRENT TABLE STRUCTURE:'
SELECT 
    'Column Info' as info_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'student_attendance' 
ORDER BY ordinal_position;

-- Check current constraints
\echo '🔒 CURRENT CONSTRAINTS:'
SELECT 
    'Constraint Info' as info_type,
    constraint_name,
    constraint_type,
    CASE 
        WHEN constraint_name LIKE '%unique%' THEN '🔑 UNIQUE'
        WHEN constraint_name LIKE '%pkey%' THEN '🗝️ PRIMARY'
        WHEN constraint_name LIKE '%fkey%' THEN '🔗 FOREIGN'
        WHEN constraint_name LIKE '%check%' THEN '✅ CHECK'
        ELSE '❓ OTHER'
    END as constraint_category
FROM information_schema.table_constraints 
WHERE table_name = 'student_attendance'
ORDER BY constraint_type;

-- Check specific unique constraints
\echo '🎯 UNIQUE CONSTRAINTS DETAILS:'
SELECT 
    tc.constraint_name,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE' 
    AND tc.table_name = 'student_attendance'
GROUP BY tc.constraint_name;

-- Check if tenant_id column exists
\echo '🏢 TENANT_ID COLUMN STATUS:'
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_attendance' AND column_name = 'tenant_id'
    ) THEN '✅ tenant_id column EXISTS' 
    ELSE '❌ tenant_id column MISSING' END as tenant_status;

-- Check RLS status
\echo '🛡️ ROW LEVEL SECURITY STATUS:'
SELECT 
    'RLS Status' as info_type,
    schemaname,
    tablename,
    CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as rls_status
FROM pg_tables 
WHERE tablename = 'student_attendance';

-- Check existing data count
\echo '📊 DATA STATUS:'
SELECT 
    'Data Count' as info_type,
    COUNT(*) as total_records,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as records_with_tenant_id,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as records_without_tenant_id
FROM student_attendance;

-- Show sample records (if any)
\echo '📋 SAMPLE RECORDS (FIRST 3):';
SELECT 
    id, 
    student_id, 
    date, 
    status, 
    CASE WHEN tenant_id IS NOT NULL THEN '✅ HAS TENANT' ELSE '❌ NO TENANT' END as tenant_status,
    created_at
FROM student_attendance 
ORDER BY created_at DESC 
LIMIT 3;

\echo '==============================================='
\echo '✅ CONSTRAINT CHECK COMPLETED'
\echo '==============================================='
\echo ''
\echo '🔧 NEXT STEPS:'
\echo '1. If tenant_id column is missing, run the migration script'
\echo '2. If unique constraint is wrong, update it'
\echo '3. If RLS is disabled, enable it'
\echo '4. Test attendance submission after fixes'
