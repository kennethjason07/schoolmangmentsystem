-- ===================================================================
-- FIX ATTENDANCE MULTI-TENANT CONSTRAINT
-- ===================================================================
-- This script fixes the student_attendance table to support the correct
-- unique constraint for multi-tenant operations
-- 
-- Run this in your Supabase SQL Editor

\echo 'Starting attendance table fix for multi-tenant support...'

-- Step 1: Check if tenant_id column exists and add it if missing
DO $$
DECLARE
    default_tenant_id UUID;
    updated_count INTEGER;
BEGIN
    -- Add tenant_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_attendance' AND column_name = 'tenant_id'
    ) THEN
        -- Get the first tenant ID as default
        SELECT id INTO default_tenant_id FROM public.tenants LIMIT 1;
        
        IF default_tenant_id IS NULL THEN
            RAISE EXCEPTION 'No tenants found. Please ensure tenant data exists before running this migration.';
        END IF;
        
        -- Add the column
        ALTER TABLE public.student_attendance ADD COLUMN tenant_id UUID;
        RAISE NOTICE 'Added tenant_id column to student_attendance table';
        
        -- Update existing records with default tenant
        UPDATE public.student_attendance SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % existing records with default tenant_id', updated_count;
        
        -- Make it NOT NULL and add foreign key
        ALTER TABLE public.student_attendance ALTER COLUMN tenant_id SET NOT NULL;
        ALTER TABLE public.student_attendance 
        ADD CONSTRAINT student_attendance_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
        
        RAISE NOTICE 'Set tenant_id as NOT NULL and added foreign key constraint';
    ELSE
        RAISE NOTICE 'tenant_id column already exists';
        
        -- Still update any NULL values if they exist
        SELECT id INTO default_tenant_id FROM public.tenants LIMIT 1;
        UPDATE public.student_attendance SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        IF updated_count > 0 THEN
            RAISE NOTICE 'Updated % records that had NULL tenant_id', updated_count;
        END IF;
    END IF;
END $$;

-- Step 2: Drop old constraints and create the correct multi-tenant constraint
DO $$
BEGIN
    -- Drop any existing unique constraints that don't include tenant_id
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day') THEN
        ALTER TABLE public.student_attendance DROP CONSTRAINT unique_attendance_per_day;
        RAISE NOTICE 'Dropped old unique_attendance_per_day constraint';
    END IF;
    
    -- Drop if the old constraint exists with different name
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_attendance_student_id_date_key') THEN
        ALTER TABLE public.student_attendance DROP CONSTRAINT student_attendance_student_id_date_key;
        RAISE NOTICE 'Dropped old student_attendance_student_id_date_key constraint';
    END IF;
    
    -- Create the new multi-tenant unique constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day_tenant') THEN
        ALTER TABLE public.student_attendance 
        ADD CONSTRAINT unique_attendance_per_day_tenant 
        UNIQUE (student_id, date, tenant_id);
        RAISE NOTICE 'Created new unique_attendance_per_day_tenant constraint';
    ELSE
        RAISE NOTICE 'unique_attendance_per_day_tenant constraint already exists';
    END IF;
END $$;

-- Step 3: Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_student_date 
ON public.student_attendance USING btree (tenant_id, student_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_class_date 
ON public.student_attendance USING btree (tenant_id, class_id, date DESC);

-- Step 4: Enable RLS and create policies
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS tenant_isolation_policy ON public.student_attendance;
DROP POLICY IF EXISTS service_role_policy ON public.student_attendance;

-- Create tenant isolation policy
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

-- Create service role policy (full access)
CREATE POLICY service_role_policy ON public.student_attendance
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 5: Grant permissions
GRANT ALL ON public.student_attendance TO authenticated;
GRANT ALL ON public.student_attendance TO service_role;

-- Step 6: Verification
\echo 'Verifying the fix...'

-- Check the constraint was created
DO $$
DECLARE
    constraint_exists BOOLEAN;
    tenant_column_exists BOOLEAN;
    rls_enabled BOOLEAN;
BEGIN
    -- Check constraint
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day_tenant'
    ) INTO constraint_exists;
    
    -- Check tenant_id column
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_attendance' AND column_name = 'tenant_id'
    ) INTO tenant_column_exists;
    
    -- Check RLS
    SELECT rowsecurity INTO rls_enabled 
    FROM pg_tables 
    WHERE tablename = 'student_attendance';
    
    RAISE NOTICE '=== VERIFICATION RESULTS ===';
    RAISE NOTICE 'Unique constraint (student_id, date, tenant_id): %', 
        CASE WHEN constraint_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE 'tenant_id column: %', 
        CASE WHEN tenant_column_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
    RAISE NOTICE 'RLS enabled: %', 
        CASE WHEN rls_enabled THEN '✅ YES' ELSE '❌ NO' END;
    
    IF constraint_exists AND tenant_column_exists AND rls_enabled THEN
        RAISE NOTICE '🎉 MIGRATION SUCCESSFUL! Ready for multi-tenant attendance submission.';
    ELSE
        RAISE WARNING '⚠️ Migration incomplete. Please check the issues above.';
    END IF;
END $$;

\echo 'Attendance table migration completed!'
