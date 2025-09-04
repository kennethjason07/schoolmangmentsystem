-- CHECK WHAT TABLES EXIST IN YOUR CURRENT DATABASE
-- Run this in your main school management system database

SELECT 'Tables in your current database:' as status;

-- List all public tables
SELECT 
    table_name,
    table_type,
    'EXISTS' as status
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Count total tables
SELECT 
    'Total tables found: ' || COUNT(*) as summary
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Check if any school-related tables exist
SELECT 'School-related tables found:' as status;
SELECT 
    table_name,
    'SCHOOL TABLE' as type
FROM information_schema.tables 
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE '%student%' OR
    table_name LIKE '%teacher%' OR 
    table_name LIKE '%class%' OR
    table_name LIKE '%school%' OR
    table_name LIKE '%parent%' OR
    table_name LIKE '%exam%' OR
    table_name LIKE '%attendance%'
  )
ORDER BY table_name;

-- Final recommendation
SELECT 
CASE 
    WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('students', 'teachers', 'classes')
    ) THEN '✅ School tables exist - Check your app connection'
    WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    ) THEN '⚠️ Other tables exist but no school tables - May need to create them'
    ELSE '❌ No tables found - Database is empty, need to create schema'
END as recommendation;
