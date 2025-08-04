-- Create homeworks table and setup
-- Run this SQL in your Supabase SQL editor

-- 1. Check if homeworks table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'homeworks'
) as table_exists;

-- 2. Create homeworks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    due_date DATE,
    class_id UUID,
    subject_id UUID,
    teacher_id UUID,
    assigned_students UUID[],
    files JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add foreign key constraints if tables exist
-- Check if classes table exists and add constraint
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classes' AND table_schema = 'public') THEN
        -- Add foreign key constraint for class_id if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'homeworks_class_id_fkey' 
            AND table_name = 'homeworks'
        ) THEN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_class_id_fkey 
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for class_id';
        END IF;
    ELSE
        RAISE NOTICE 'Classes table does not exist - skipping class_id foreign key';
    END IF;
END $$;

-- 4. Add subject foreign key if subjects table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'subjects' AND table_schema = 'public') THEN
        -- Add foreign key constraint for subject_id if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'homeworks_subject_id_fkey' 
            AND table_name = 'homeworks'
        ) THEN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_subject_id_fkey 
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for subject_id';
        END IF;
    ELSE
        RAISE NOTICE 'Subjects table does not exist - skipping subject_id foreign key';
    END IF;
END $$;

-- 5. Add teacher foreign key if teachers table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teachers' AND table_schema = 'public') THEN
        -- Add foreign key constraint for teacher_id if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'homeworks_teacher_id_fkey' 
            AND table_name = 'homeworks'
        ) THEN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_teacher_id_fkey 
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for teacher_id';
        END IF;
    ELSE
        RAISE NOTICE 'Teachers table does not exist - skipping teacher_id foreign key';
    END IF;
END $$;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_subject_id ON homeworks(subject_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_id ON homeworks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_due_date ON homeworks(due_date);

-- 7. Enable Row Level Security (RLS) if needed
ALTER TABLE homeworks ENABLE ROW LEVEL SECURITY;

-- 8. Create basic RLS policies (adjust as needed for your security requirements)
-- Drop existing policies if they exist, then recreate them
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Teachers can view their own homework" ON homeworks;
    DROP POLICY IF EXISTS "Teachers can insert their own homework" ON homeworks;
    DROP POLICY IF EXISTS "Teachers can update their own homework" ON homeworks;
    DROP POLICY IF EXISTS "Teachers can delete their own homework" ON homeworks;
    DROP POLICY IF EXISTS "Students can view assigned homework" ON homeworks;

    RAISE NOTICE 'Dropped existing policies (if any)';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No existing policies to drop or error occurred: %', SQLERRM;
END $$;

-- Policy for teachers to see their own homework
CREATE POLICY "Teachers can view their own homework" ON homeworks
    FOR SELECT USING (teacher_id IN (
        SELECT t.id FROM teachers t
        JOIN users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    ));

-- Policy for teachers to insert their own homework
CREATE POLICY "Teachers can insert their own homework" ON homeworks
    FOR INSERT WITH CHECK (teacher_id IN (
        SELECT t.id FROM teachers t
        JOIN users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    ));

-- Policy for teachers to update their own homework
CREATE POLICY "Teachers can update their own homework" ON homeworks
    FOR UPDATE USING (teacher_id IN (
        SELECT t.id FROM teachers t
        JOIN users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    ));

-- Policy for teachers to delete their own homework
CREATE POLICY "Teachers can delete their own homework" ON homeworks
    FOR DELETE USING (teacher_id IN (
        SELECT t.id FROM teachers t
        JOIN users u ON u.linked_teacher_id = t.id
        WHERE u.id = auth.uid()
    ));

-- Policy for students to view homework assigned to them
CREATE POLICY "Students can view assigned homework" ON homeworks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.linked_student_id = ANY(assigned_students)
        )
    );

-- 9. Insert sample homework data for testing
INSERT INTO homeworks (
    title,
    description,
    instructions,
    due_date,
    assigned_students,
    created_at
) VALUES 
(
    'Sample Math Assignment',
    'Complete the exercises from Chapter 5: Algebra Basics',
    'Please show all working steps and submit neat handwritten solutions.',
    CURRENT_DATE + INTERVAL '7 days',
    ARRAY[]::UUID[],
    NOW()
),
(
    'Science Project',
    'Prepare a presentation on renewable energy sources',
    'Include at least 3 different types of renewable energy with examples.',
    CURRENT_DATE + INTERVAL '14 days',
    ARRAY[]::UUID[],
    NOW()
),
(
    'English Essay',
    'Write a 500-word essay on "The Importance of Education"',
    'Use proper grammar, structure your essay with introduction, body, and conclusion.',
    CURRENT_DATE + INTERVAL '10 days',
    ARRAY[]::UUID[],
    NOW()
)
ON CONFLICT DO NOTHING;

-- 10. Verify the table was created successfully
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'homeworks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 11. Show sample data
SELECT 
    id,
    title,
    description,
    due_date,
    created_at
FROM homeworks 
ORDER BY created_at DESC
LIMIT 5;

-- 12. Show foreign key constraints
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
AND tc.table_name = 'homeworks';

-- 13. Final success message
DO $$
BEGIN
    RAISE NOTICE 'Homeworks table setup complete!';
END $$;
