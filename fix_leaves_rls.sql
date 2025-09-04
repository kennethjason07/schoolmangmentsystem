-- RLS Policies for Leave Applications
-- Run this in Supabase SQL Editor to enable leave management functionality

-- ========================================
-- STEP 1: Enable RLS on leave_applications table
-- ========================================

-- Enable Row Level Security
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 2: Create RLS policies for leave_applications
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anon to read leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to read leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to insert leave applications" ON public.leave_applications;
DROP POLICY IF EXISTS "Allow authenticated to update leave applications" ON public.leave_applications;

-- Allow anon users to read leave applications (for initial loading)
CREATE POLICY "Allow anon to read leave applications"
ON public.leave_applications
FOR SELECT
TO anon
USING (true);

-- Allow authenticated users to read all leave applications
CREATE POLICY "Allow authenticated to read leave applications"
ON public.leave_applications
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to insert leave applications
CREATE POLICY "Allow authenticated to insert leave applications"
ON public.leave_applications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update leave applications (for status changes)
CREATE POLICY "Allow authenticated to update leave applications"
ON public.leave_applications
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- STEP 3: Create some sample leave data if table is empty
-- ========================================

-- Check if we have any leave applications
SELECT 'Current leave applications count:' as info, COUNT(*) as count 
FROM public.leave_applications;

-- First, let's check what columns actually exist in the table
-- Comment out the sample data insertion until we know the structure

-- Check table structure first
SELECT 'Checking table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'leave_applications' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show existing data if any
SELECT 'Existing data sample:' as info;
SELECT * FROM public.leave_applications LIMIT 3;

-- Create sample data based on the teacher component structure
DO $$
BEGIN
  -- Only insert sample data if table is empty
  IF (SELECT COUNT(*) FROM public.leave_applications) = 0 THEN
    -- Insert sample leave applications using the correct column structure
    -- Based on the teacher component, we know these columns exist:
    -- teacher_id, leave_type, start_date, end_date, reason, applied_by, tenant_id
    
    INSERT INTO public.leave_applications (
      teacher_id,
      leave_type,
      start_date,
      end_date,
      reason,
      applied_by,
      tenant_id
    ) VALUES 
    (
      (SELECT linked_teacher_id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'Sick Leave',
      '2025-09-05',
      '2025-09-06', 
      'Feeling unwell, need rest to recover',
      (SELECT id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'b8f8b5f0-1234-4567-8901-123456789000'
    ),
    (
      (SELECT linked_teacher_id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'Casual Leave',
      '2025-09-08',
      '2025-09-08',
      'Personal work to be completed', 
      (SELECT id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'b8f8b5f0-1234-4567-8901-123456789000'
    ),
    (
      (SELECT linked_teacher_id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'Emergency Leave',
      '2025-09-10',
      '2025-09-12',
      'Family emergency - immediate attention required',
      (SELECT id FROM public.users WHERE email = 'hanokalure@gmail.com' LIMIT 1),
      'b8f8b5f0-1234-4567-8901-123456789000'
    );
    
    RAISE NOTICE '✅ Sample leave applications created successfully!';
  ELSE
    RAISE NOTICE '📋 Leave applications already exist, skipping sample data creation.';
  END IF;
END $$;

-- ========================================
-- STEP 4: Verify the setup
-- ========================================

-- Show all leave applications
SELECT 'All leave applications:' as info;
SELECT 
    id,
    teacher_id,
    leave_type,
    start_date,
    end_date,
    status,
    reason,
    applied_by,
    tenant_id
FROM public.leave_applications
ORDER BY COALESCE(applied_date, created_at, start_date) DESC;

-- Show RLS policies
SELECT 'Leave applications RLS policies:' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'leave_applications'
ORDER BY policyname;

-- Test access
SELECT 'Testing leave applications access:' as info;
SELECT COUNT(*) as accessible_leaves FROM public.leave_applications;

-- Show success message
SELECT '✅ Leave applications RLS policies created successfully!' as completion_message;
SELECT '🎉 Leave management should now work properly!' as final_message;
