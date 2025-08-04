-- Fix homework schema and relationships
-- Run this SQL in your Supabase SQL editor

-- 1. Check current homeworks table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'homeworks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check students table structure to see actual column names
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'students' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check foreign key relationships for homeworks table
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name='homeworks';

-- 4. Check if homeworks table exists and what it contains
SELECT COUNT(*) as homework_count FROM homeworks;

-- 5. If homeworks table doesn't exist, create it with proper relationships
-- (Uncomment if needed)

/*
CREATE TABLE IF NOT EXISTS homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date DATE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    assigned_students UUID[],
    files JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
*/

-- 6. If homeworks table exists but missing foreign key to classes, add it
-- (Uncomment if needed)

/*
-- Add foreign key constraint if missing
ALTER TABLE homeworks 
ADD CONSTRAINT homeworks_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- Add foreign key constraint for subjects if missing
ALTER TABLE homeworks 
ADD CONSTRAINT homeworks_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;

-- Add foreign key constraint for teachers if missing
ALTER TABLE homeworks 
ADD CONSTRAINT homeworks_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
*/

-- 7. Check what the actual student name column is called
SELECT 
    column_name
FROM information_schema.columns 
WHERE table_name = 'students' 
AND table_schema = 'public'
AND (column_name LIKE '%name%' OR column_name LIKE '%full%');

-- 8. Show sample data from students table to understand structure
SELECT * FROM students LIMIT 3;

-- 9. Show sample data from classes table
SELECT * FROM classes LIMIT 3;

-- 10. Test the homework query that should work
-- This will help us understand what the correct query structure should be

-- First, let's see if we can query homeworks without joins
SELECT * FROM homeworks LIMIT 3;

-- Then try with proper joins based on actual foreign keys
SELECT 
    h.id,
    h.title,
    h.description,
    h.due_date,
    h.class_id,
    h.subject_id,
    h.teacher_id
FROM homeworks h
LIMIT 3;

-- 11. Create sample homework data if table is empty
-- (Uncomment if needed)

/*
-- Insert sample homework if none exists
INSERT INTO homeworks (
    title,
    description,
    instructions,
    due_date,
    class_id,
    subject_id,
    teacher_id,
    assigned_students
) 
SELECT 
    'Sample Math Homework',
    'Complete exercises 1-10 from chapter 5',
    'Show all working steps clearly',
    CURRENT_DATE + INTERVAL '7 days',
    c.id,
    s.id,
    t.id,
    ARRAY[]::UUID[]
FROM classes c
CROSS JOIN subjects s
CROSS JOIN teachers t
WHERE c.class_name = '10' 
AND s.name LIKE '%Math%'
AND t.name IS NOT NULL
LIMIT 1
ON CONFLICT DO NOTHING;
*/

-- 12. Verify relationships work after fixes
SELECT 
    h.title,
    c.class_name,
    c.section,
    s.name as subject_name,
    t.name as teacher_name
FROM homeworks h
LEFT JOIN classes c ON h.class_id = c.id
LEFT JOIN subjects s ON h.subject_id = s.id  
LEFT JOIN teachers t ON h.teacher_id = t.id
LIMIT 5;
