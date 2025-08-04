-- Basic homeworks table creation (minimal syntax)
-- Run this SQL in your Supabase SQL editor

-- 1. Create homeworks table
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

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_subject_id ON homeworks(subject_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_teacher_id ON homeworks(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_due_date ON homeworks(due_date);

-- 3. Insert sample data
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

-- 4. Verify table creation
SELECT 'Table created successfully' as status;

-- 5. Show table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'homeworks' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Show sample data
SELECT 
    id,
    title,
    due_date,
    created_at
FROM homeworks 
ORDER BY created_at DESC
LIMIT 5;

-- 7. Count records
SELECT COUNT(*) as total_homeworks FROM homeworks;
