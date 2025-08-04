-- Simple homeworks table creation (without RLS policies)
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

-- 3. Add foreign key constraints if tables exist (with error handling)
DO $$
BEGIN
    -- Add foreign key constraint for class_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'homeworks_class_id_fkey' 
        AND table_name = 'homeworks'
    ) THEN
        BEGIN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_class_id_fkey 
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for class_id';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not add class_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add foreign key constraint for subject_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'homeworks_subject_id_fkey' 
        AND table_name = 'homeworks'
    ) THEN
        BEGIN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_subject_id_fkey 
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for subject_id';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not add subject_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add foreign key constraint for teacher_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'homeworks_teacher_id_fkey' 
        AND table_name = 'homeworks'
    ) THEN
        BEGIN
            ALTER TABLE homeworks 
            ADD CONSTRAINT homeworks_teacher_id_fkey 
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added foreign key constraint for teacher_id';
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not add teacher_id foreign key: %', SQLERRM;
        END;
    END IF;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_subject_id ON homeworks(subject_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_id ON homeworks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_due_date ON homeworks(due_date);

-- 5. Insert sample homework data for testing
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
),
(
    'History Research',
    'Research and write about World War II events',
    'Focus on major battles and their impact on the war outcome.',
    CURRENT_DATE + INTERVAL '12 days',
    ARRAY[]::UUID[],
    NOW()
),
(
    'Computer Programming',
    'Create a simple calculator program',
    'Use any programming language you are comfortable with.',
    CURRENT_DATE + INTERVAL '21 days',
    ARRAY[]::UUID[],
    NOW()
)
ON CONFLICT DO NOTHING;

-- 6. Verify the table was created successfully
SELECT 
    'Table Structure' as info_type,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'homeworks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Show sample data
SELECT 
    'Sample Data' as info_type,
    id,
    title,
    description,
    due_date,
    created_at
FROM homeworks 
ORDER BY created_at DESC
LIMIT 5;

-- 8. Show foreign key constraints
SELECT
    'Foreign Keys' as info_type,
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

-- 9. Count records
SELECT 
    'Record Count' as info_type,
    COUNT(*) as total_homeworks
FROM homeworks;

-- Success message
SELECT 'Setup Complete!' as status, 'Homeworks table created successfully' as message;
