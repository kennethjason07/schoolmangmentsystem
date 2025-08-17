-- Check current database structure to understand what tables and columns exist

-- Check if parent_student_relationships table exists
SELECT 'parent_student_relationships table exists' as status 
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'parent_student_relationships'
);

-- Check columns in users table
SELECT 'users table columns:' as info, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- Check columns in parents table  
SELECT 'parents table columns:' as info, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'parents' 
ORDER BY ordinal_position;

-- Check columns in students table
SELECT 'students table columns:' as info, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'students' 
ORDER BY ordinal_position;

-- Check if parent_student_relationships table exists and its structure
SELECT 'parent_student_relationships columns:' as info, column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'parent_student_relationships' 
ORDER BY ordinal_position;

-- Check foreign key constraints
SELECT 
    'Foreign Key Constraints:' as info,
    tc.table_name, 
    tc.constraint_name, 
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
    AND tc.table_name IN ('users', 'parents', 'students', 'parent_student_relationships')
ORDER BY tc.table_name, tc.constraint_name;
