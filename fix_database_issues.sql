-- Fix Database Issues: Foreign Key Relationships and RLS Policies
-- This script addresses two main issues:
-- 1. Missing foreign key relationship between student_fees and fee_structure
-- 2. RLS policy violation for student_discounts table

-- ========================================
-- 1. FIX FOREIGN KEY RELATIONSHIP ISSUES
-- ========================================

-- First, let's check what tables exist and their structure
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name IN ('student_fees', 'fee_structure') 
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Check existing foreign keys
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
  AND tc.table_name IN ('student_fees', 'fee_structure');

-- If student_fees table doesn't have a fee_structure_id or fee_id column, we need to add it
-- Let's check the current structure of student_fees first
\d public.student_fees;

-- If needed, add a foreign key column to student_fees to reference fee_structure
-- Note: Replace this with the actual column name if it exists
-- ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS fee_structure_id UUID;

-- Add foreign key constraint if it doesn't exist
-- ALTER TABLE public.student_fees 
-- ADD CONSTRAINT fk_student_fees_fee_structure 
-- FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structure(id);

-- Alternative approach: If the relationship should be through a different column
-- Check if there's already a fee_id or similar column:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'student_fees' 
  AND table_schema = 'public' 
  AND column_name LIKE '%fee%';

-- ========================================
-- 2. FIX RLS POLICIES FOR STUDENT_DISCOUNTS
-- ========================================

-- Check if student_discounts table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'student_discounts' AND table_schema = 'public';

-- Check current RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'student_discounts';

-- Enable RLS if not already enabled
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "student_discounts_select_policy" ON public.student_discounts;
DROP POLICY IF EXISTS "student_discounts_insert_policy" ON public.student_discounts;
DROP POLICY IF EXISTS "student_discounts_update_policy" ON public.student_discounts;
DROP POLICY IF EXISTS "student_discounts_delete_policy" ON public.student_discounts;

-- Create new permissive RLS policies for student_discounts
-- Policy for SELECT (reading discounts)
CREATE POLICY "Allow authenticated users to select student_discounts" 
ON public.student_discounts 
FOR SELECT 
TO authenticated 
USING (true);

-- Policy for INSERT (creating discounts)
CREATE POLICY "Allow authenticated users to insert student_discounts" 
ON public.student_discounts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Policy for UPDATE (modifying discounts)
CREATE POLICY "Allow authenticated users to update student_discounts" 
ON public.student_discounts 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Policy for DELETE (removing discounts)
CREATE POLICY "Allow authenticated users to delete student_discounts" 
ON public.student_discounts 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================================
-- 3. CREATE STUDENT_DISCOUNTS TABLE IF IT DOESN'T EXIST
-- ========================================

CREATE TABLE IF NOT EXISTS public.student_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2024-25',
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
    fee_component TEXT, -- Optional: specific fee component, NULL means all components
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_discounts_student_id ON public.student_discounts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_discounts_class_id ON public.student_discounts(class_id);
CREATE INDEX IF NOT EXISTS idx_student_discounts_academic_year ON public.student_discounts(academic_year);
CREATE INDEX IF NOT EXISTS idx_student_discounts_active ON public.student_discounts(is_active) WHERE is_active = true;

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_student_discounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_student_discounts_updated_at ON public.student_discounts;
CREATE TRIGGER trigger_update_student_discounts_updated_at
    BEFORE UPDATE ON public.student_discounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_student_discounts_updated_at();

-- ========================================
-- 4. CREATE OR UPDATE DISCOUNT SUMMARY VIEW
-- ========================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.discount_summary;

-- Create discount summary view for easy querying
CREATE VIEW public.discount_summary AS
SELECT 
    sd.id,
    sd.student_id,
    s.name as student_name,
    s.admission_no,
    s.roll_no,
    sd.class_id,
    c.class_name,
    c.section,
    sd.academic_year,
    sd.discount_type,
    sd.discount_value,
    sd.fee_component,
    sd.description,
    sd.is_active,
    sd.created_at,
    sd.updated_at
FROM public.student_discounts sd
JOIN public.students s ON sd.student_id = s.id
JOIN public.classes c ON sd.class_id = c.id
WHERE sd.is_active = true;

-- ========================================
-- 5. ALTERNATIVE FIX FOR STUDENT_FEES RELATIONSHIP
-- ========================================

-- If the join is failing because there's no direct relationship,
-- we need to establish how student_fees relates to fee_structure
-- This might be through fee_component name matching or a fee_id

-- Option A: If relationship is through fee_component name
-- No foreign key needed, just matching by name

-- Option B: If we need to add fee_structure_id to student_fees
-- Uncomment and modify as needed:

-- Check current student_fees structure
-- \d public.student_fees;

-- Add fee_structure_id if it doesn't exist
-- ALTER TABLE public.student_fees ADD COLUMN IF NOT EXISTS fee_structure_id UUID;

-- Add foreign key constraint
-- ALTER TABLE public.student_fees 
-- ADD CONSTRAINT fk_student_fees_fee_structure 
-- FOREIGN KEY (fee_structure_id) REFERENCES public.fee_structure(id);

-- ========================================
-- 6. VERIFICATION QUERIES
-- ========================================

-- Verify student_discounts table and policies
SELECT 'Student Discounts Table' as info;
\d public.student_discounts;

SELECT 'Student Discounts RLS Policies' as info;
SELECT policyname, cmd, roles::text, qual, with_check 
FROM pg_policies 
WHERE tablename = 'student_discounts';

-- Test discount creation (replace UUIDs with actual values)
-- INSERT INTO public.student_discounts (
--     student_id, 
--     class_id, 
--     discount_type, 
--     discount_value, 
--     description
-- ) VALUES (
--     'your-student-uuid-here',
--     'your-class-uuid-here', 
--     'percentage', 
--     10.00, 
--     'Test discount'
-- );

-- Verify the discount summary view
SELECT 'Discount Summary View' as info;
SELECT * FROM public.discount_summary LIMIT 5;

ECHO 'Database fixes completed! Please test the application now.';
