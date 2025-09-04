-- ================================================================
-- UPDATE STUDENT_ATTENDANCE SCHEMA WITH TENANT_ID AND RLS
-- ================================================================
-- This script ensures the student_attendance table has proper tenant_id
-- support and Row Level Security for multi-tenant isolation
--
-- Based on schema.txt requirements

BEGIN;

-- Step 1: Ensure tenant_id column exists with proper constraints
DO $$
BEGIN
    -- Add tenant_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_attendance' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.student_attendance ADD COLUMN tenant_id uuid NOT NULL;
        RAISE NOTICE 'Added tenant_id column to student_attendance table';
    ELSE
        RAISE NOTICE 'tenant_id column already exists in student_attendance table';
    END IF;
    
    -- Add foreign key constraint for tenant_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_attendance_tenant_id_fkey') THEN
        ALTER TABLE public.student_attendance
        ADD CONSTRAINT student_attendance_tenant_id_fkey 
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
        RAISE NOTICE 'Added tenant_id foreign key constraint';
    END IF;
END $$;

-- Step 2: Update any existing records without tenant_id
DO $$
DECLARE
    default_tenant_id UUID;
    updated_count INTEGER := 0;
BEGIN
    -- Get the first tenant as default (or create one if none exists)
    SELECT id INTO default_tenant_id FROM public.tenants LIMIT 1;
    
    IF default_tenant_id IS NULL THEN
        -- Create a default tenant if none exists
        INSERT INTO public.tenants (id, name, subdomain, status)
        VALUES (
            gen_random_uuid(),
            'Default School',
            'default',
            'active'
        )
        RETURNING id INTO default_tenant_id;
        
        RAISE NOTICE 'Created default tenant: %', default_tenant_id;
    END IF;
    
    -- Update attendance records without tenant_id
    UPDATE public.student_attendance 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    IF updated_count > 0 THEN
        RAISE NOTICE 'Updated % attendance records with default tenant_id', updated_count;
    END IF;
END $$;

-- Step 3: Drop old unique constraint if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day') THEN
        ALTER TABLE public.student_attendance DROP CONSTRAINT unique_attendance_per_day;
        RAISE NOTICE 'Dropped old unique_attendance_per_day constraint';
    END IF;
END $$;

-- Step 4: Add new unique constraint including tenant_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_attendance_per_day_tenant') THEN
        ALTER TABLE public.student_attendance 
        ADD CONSTRAINT unique_attendance_per_day_tenant 
        UNIQUE (student_id, date, tenant_id);
        RAISE NOTICE 'Created unique_attendance_per_day_tenant constraint';
    ELSE
        RAISE NOTICE 'unique_attendance_per_day_tenant constraint already exists';
    END IF;
END $$;

-- Step 5: Create optimized indexes for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_id 
ON public.student_attendance(tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_student_date 
ON public.student_attendance(tenant_id, student_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_class_date 
ON public.student_attendance(tenant_id, class_id, date DESC);

-- Step 6: Enable Row Level Security
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;

-- Step 7: Drop existing RLS policies if they exist
DROP POLICY IF EXISTS tenant_isolation_policy ON public.student_attendance;
DROP POLICY IF EXISTS service_role_policy ON public.student_attendance;

-- Step 8: Create comprehensive RLS policies

-- Policy 1: Tenant isolation for authenticated users
-- Users can only access attendance records for their tenant
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

-- Policy 2: Full access for service role (for system operations)
CREATE POLICY service_role_policy ON public.student_attendance
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 3: Anonymous access (if needed for public features)
-- CREATE POLICY anonymous_policy ON public.student_attendance
--     FOR SELECT
--     TO anon
--     USING (false); -- Deny by default, modify as needed

-- Step 9: Grant necessary permissions
GRANT ALL ON public.student_attendance TO authenticated;
GRANT ALL ON public.student_attendance TO service_role;

-- Step 10: Create helper function to get user's tenant_id
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id 
        FROM public.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on helper function
GRANT EXECUTE ON FUNCTION get_user_tenant_id() TO authenticated;

COMMIT;

-- Step 11: Verification queries
DO $$
BEGIN
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ ATTENDANCE SCHEMA UPDATE COMPLETED';
    RAISE NOTICE '================================================';
    RAISE NOTICE 'Features implemented:';
    RAISE NOTICE '1. ✓ tenant_id column with foreign key constraint';
    RAISE NOTICE '2. ✓ Multi-tenant unique constraint (student_id, date, tenant_id)';
    RAISE NOTICE '3. ✓ Row Level Security policies for tenant isolation';
    RAISE NOTICE '4. ✓ Optimized indexes for multi-tenant queries';
    RAISE NOTICE '5. ✓ Helper function for tenant_id retrieval';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '- Update application code to use tenant_id in queries';
    RAISE NOTICE '- Use onConflict: "student_id,date,tenant_id" in upsert operations';
    RAISE NOTICE '- Test attendance submission functionality';
END $$;

-- Show final table structure
SELECT 
    'Table Structure' as info_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'student_attendance' 
ORDER BY ordinal_position;

-- Show constraints
SELECT 
    'Constraints' as info_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'student_attendance';

-- Show RLS status
SELECT 
    'RLS Status' as info_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'student_attendance';
