-- ===================================================================
-- FIX ATTENDANCE TABLE FOR MULTI-TENANT SUPPORT
-- ===================================================================
-- This script fixes the student_attendance table to support multi-tenancy
-- and resolves the ON CONFLICT constraint error

-- Step 1: Ensure tenant_id column exists (should already exist from migration)
DO $$
BEGIN
  -- Add tenant_id to student_attendance table if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_attendance' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.student_attendance ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    RAISE NOTICE 'Added tenant_id column to student_attendance table';
  ELSE
    RAISE NOTICE 'tenant_id column already exists in student_attendance table';
  END IF;
END $$;

-- Step 2: Update any existing attendance records to have tenant_id
DO $$
DECLARE
  default_tenant_id UUID;
  updated_count INTEGER;
BEGIN
  -- Get the default tenant ID
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE domain = 'default.school.local' OR name = 'Default School'
  LIMIT 1;

  IF default_tenant_id IS NOT NULL THEN
    -- Update student_attendance records that don't have tenant_id
    UPDATE public.student_attendance 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % attendance records with default tenant_id', updated_count;
  ELSE
    RAISE NOTICE 'No default tenant found - please ensure tenant migration has been run';
  END IF;
END $$;

-- Step 3: Drop the old unique constraint and create a new multi-tenant one
DO $$
BEGIN
  -- Drop the old unique constraint
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day') THEN
    ALTER TABLE public.student_attendance DROP CONSTRAINT unique_attendance_per_day;
    RAISE NOTICE 'Dropped old unique_attendance_per_day constraint';
  END IF;
  
  -- Create new unique constraint that includes tenant_id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day_tenant') THEN
    ALTER TABLE public.student_attendance 
    ADD CONSTRAINT unique_attendance_per_day_tenant 
    UNIQUE (student_id, date, tenant_id);
    RAISE NOTICE 'Created new unique_attendance_per_day_tenant constraint';
  ELSE
    RAISE NOTICE 'unique_attendance_per_day_tenant constraint already exists';
  END IF;
END $$;

-- Step 4: Create index for tenant_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_id 
ON public.student_attendance(tenant_id);

-- Step 5: Update indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_student_date 
ON public.student_attendance USING btree (tenant_id, student_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_class_date 
ON public.student_attendance USING btree (tenant_id, class_id, date DESC);

-- Step 6: Enable RLS on student_attendance table
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for student_attendance
-- Policy for users to see only their tenant's attendance records
DROP POLICY IF EXISTS tenant_isolation_policy ON public.student_attendance;
CREATE POLICY tenant_isolation_policy ON public.student_attendance
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = (
      SELECT u.tenant_id 
      FROM public.users u 
      WHERE u.id = auth.uid()
    )
  );

-- Policy for service role (full access)
DROP POLICY IF EXISTS service_role_policy ON public.student_attendance;
CREATE POLICY service_role_policy ON public.student_attendance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 8: Grant necessary permissions
GRANT ALL ON public.student_attendance TO authenticated;
GRANT ALL ON public.student_attendance TO service_role;

-- Step 9: Verification queries
SELECT 
  'student_attendance_table_info' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'student_attendance' 
AND column_name IN ('id', 'student_id', 'date', 'tenant_id')
ORDER BY column_name;

-- Check constraints
SELECT 
  'constraints' as check_type,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'student_attendance'
AND constraint_name LIKE '%unique%';

-- Check RLS status
SELECT 
  'rls_status' as check_type,
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'student_attendance';

-- Display completion message
DO $$
BEGIN
  RAISE NOTICE '=== ATTENDANCE TABLE FIX COMPLETED ===';
  RAISE NOTICE '1. tenant_id column added/verified';
  RAISE NOTICE '2. Unique constraint updated to include tenant_id';
  RAISE NOTICE '3. RLS policies created for tenant isolation';
  RAISE NOTICE '4. Indexes optimized for multi-tenant queries';
  RAISE NOTICE '5. Ready for attendance submission with ON CONFLICT support';
END $$;
