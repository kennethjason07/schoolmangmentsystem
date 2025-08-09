-- VERIFICATION SCRIPT: Check Current Database State
-- Run this BEFORE and AFTER the rollback to see what changes

-- Check 1: List all tables that currently have school_id columns
SELECT 
    'Tables with school_id columns:' as check_type,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE column_name = 'school_id' 
AND table_schema = 'public'
ORDER BY table_name;

-- Check 2: List multi-school specific tables
SELECT 
    'Multi-school specific tables:' as check_type,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('schools', 'school_users', 'school_details')
ORDER BY table_name;

-- Check 3: List foreign key constraints related to school_id
SELECT 
    'Foreign key constraints for school_id:' as check_type,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND (kcu.column_name = 'school_id' OR ccu.column_name = 'school_id')
ORDER BY tc.table_name;

-- Check 4: List indexes related to school_id
SELECT 
    'Indexes related to school_id:' as check_type,
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE '%school_id%'
ORDER BY tablename;

-- Check 5: List RLS policies that might be multi-school related
SELECT 
    'RLS Policies:' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
AND (policyname LIKE '%school%' OR qual LIKE '%school%')
ORDER BY tablename;

-- Check 6: List functions that might be multi-school related
SELECT 
    'Multi-school functions:' as check_type,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name LIKE '%school%'
ORDER BY routine_name;

-- Check 7: Check school_details table structure
SELECT 
    'school_details table columns:' as check_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'school_details' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check 8: Count records in multi-school tables
SELECT 'Record counts in multi-school tables:' as check_type;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schools' AND table_schema = 'public') THEN
        RAISE NOTICE 'schools table: % records', (SELECT COUNT(*) FROM schools);
    ELSE
        RAISE NOTICE 'schools table: does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'school_users' AND table_schema = 'public') THEN
        RAISE NOTICE 'school_users table: % records', (SELECT COUNT(*) FROM school_users);
    ELSE
        RAISE NOTICE 'school_users table: does not exist';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'school_details' AND table_schema = 'public') THEN
        RAISE NOTICE 'school_details table: % records', (SELECT COUNT(*) FROM school_details);
    ELSE
        RAISE NOTICE 'school_details table: does not exist';
    END IF;
END $$;

-- Check 9: List all triggers that might be multi-school related
SELECT 
    'Multi-school triggers:' as check_type,
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND (trigger_name LIKE '%school%' OR action_statement LIKE '%school%')
ORDER BY event_object_table;

SELECT 'Database state check completed!' as status;
