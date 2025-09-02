-- Check actual column names in tables
SELECT 'Table Schemas Check' as step;

-- Check school_details columns
SELECT 
  'school_details_columns' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'school_details' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check students columns  
SELECT 
  'students_columns' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'students' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check classes columns
SELECT 
  'classes_columns' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'classes' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check teachers columns
SELECT 
  'teachers_columns' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'teachers' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check users columns
SELECT 
  'users_columns' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'public'
ORDER BY ordinal_position;
