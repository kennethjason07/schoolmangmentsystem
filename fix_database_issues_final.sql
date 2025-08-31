-- Fix Database Issues - Clean Version
-- Based on actual table schemas provided

-- ========================================
-- 1. FIX RLS POLICIES FOR STUDENT_DISCOUNTS
-- ========================================

-- Enable RLS if not already enabled
ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;

-- Drop any overly restrictive existing policies
DROP POLICY IF EXISTS "student_discounts_select_policy" ON public.student_discounts;
DROP POLICY IF EXISTS "student_discounts_insert_policy" ON public.student_discounts;  
DROP POLICY IF EXISTS "student_discounts_update_policy" ON public.student_discounts;
DROP POLICY IF EXISTS "student_discounts_delete_policy" ON public.student_discounts;

-- Create permissive RLS policies for authenticated users
CREATE POLICY "Allow authenticated users to select student_discounts" 
ON public.student_discounts 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated users to insert student_discounts" 
ON public.student_discounts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update student_discounts" 
ON public.student_discounts 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete student_discounts" 
ON public.student_discounts 
FOR DELETE 
TO authenticated 
USING (true);

-- ========================================
-- 2. CREATE DISCOUNT SUMMARY VIEW
-- ========================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.discount_summary;

-- Create discount summary view that matches your dbHelpers.getDiscountSummary expectation
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
    COALESCE(sd.updated_at, sd.created_at) as updated_at
FROM public.student_discounts sd
JOIN public.students s ON sd.student_id = s.id
JOIN public.classes c ON sd.class_id = c.id
WHERE sd.is_active = true;

-- ========================================
-- 3. ADD MISSING updated_at COLUMN AND TRIGGER
-- ========================================

-- Add updated_at column if it doesn't exist
ALTER TABLE public.student_discounts 
ADD COLUMN IF NOT EXISTS updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION public.update_student_discounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_student_discounts_updated_at ON public.student_discounts;
CREATE TRIGGER trigger_update_student_discounts_updated_at
    BEFORE UPDATE ON public.student_discounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_student_discounts_updated_at();

-- ========================================
-- 4. VERIFY THE FIXES
-- ========================================

-- Test RLS policies
SELECT 'RLS Policies for student_discounts' as info_type, policyname, cmd, roles::text
FROM pg_policies 
WHERE tablename = 'student_discounts'
ORDER BY cmd;

-- Test the discount summary view
SELECT 'Discount Summary View' as info_type, COUNT(*) as total_active_discounts 
FROM public.discount_summary;
