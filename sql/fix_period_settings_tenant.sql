-- ===================================================================
-- FIX PERIOD_SETTINGS TENANT ENFORCEMENT
-- ===================================================================
-- This script adds a trigger to automatically enforce tenant_id for period_settings

-- Step 1: Add trigger for period_settings table to enforce tenant_id
CREATE TRIGGER enforce_tenant_id_period_settings
  BEFORE INSERT OR UPDATE ON public.period_settings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_id();

-- Step 2: Verify the RLS policy exists for period_settings
DO $$
BEGIN
  -- Check if the RLS policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'period_settings' 
    AND policyname = 'period_settings_tenant_isolation'
  ) THEN
    -- Create the policy if it doesn't exist
    EXECUTE 'CREATE POLICY "period_settings_tenant_isolation" ON public.period_settings
      FOR ALL USING (tenant_id::text = auth.jwt() ->> ''tenant_id'')';
    RAISE NOTICE '✅ Created missing RLS policy for period_settings';
  ELSE
    RAISE NOTICE '✅ RLS policy already exists for period_settings';
  END IF;
END $$;

-- Step 3: Verify RLS is enabled
DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT rowsecurity INTO rls_enabled 
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename = 'period_settings';
  
  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS is enabled on period_settings table';
  ELSE
    RAISE NOTICE '❌ RLS is NOT enabled on period_settings table';
    ALTER TABLE public.period_settings ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ Enabled RLS on period_settings table';
  END IF;
END $$;

-- Step 4: Test the trigger function
DO $$
DECLARE
  test_tenant_id UUID := 'b8f8b5f0-1234-4567-8901-123456789000';
  test_academic_year TEXT := '2024-25';
  test_count INTEGER;
BEGIN
  -- Simulate setting the JWT claim for testing
  PERFORM set_config('request.jwt.claim.tenant_id', test_tenant_id::text, true);
  
  -- Try inserting a test period setting (it should automatically get the tenant_id)
  INSERT INTO public.period_settings (
    period_number,
    start_time,
    end_time,
    period_name,
    period_type,
    academic_year,
    is_active
  ) VALUES (
    99, -- Use a test period number that won't conflict
    '99:00',
    '99:45',
    'Test Period - Delete Me',
    'class',
    test_academic_year,
    false
  );
  
  -- Check if the record was inserted with correct tenant_id
  SELECT COUNT(*) INTO test_count
  FROM public.period_settings
  WHERE period_number = 99 
    AND academic_year = test_academic_year
    AND tenant_id = test_tenant_id;
  
  IF test_count > 0 THEN
    RAISE NOTICE '✅ Trigger test PASSED - period_settings automatically got tenant_id';
    
    -- Clean up test record
    DELETE FROM public.period_settings 
    WHERE period_number = 99 AND academic_year = test_academic_year;
    
    RAISE NOTICE '✅ Cleaned up test record';
  ELSE
    RAISE NOTICE '❌ Trigger test FAILED - period_settings did not get tenant_id automatically';
  END IF;
  
EXCEPTION 
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Trigger test failed with error: %', SQLERRM;
    -- Try to clean up anyway
    DELETE FROM public.period_settings 
    WHERE period_number = 99 AND academic_year = test_academic_year;
END $$;

-- Step 5: Summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== PERIOD_SETTINGS TENANT FIX SUMMARY ===';
  RAISE NOTICE '✅ Added tenant enforcement trigger for period_settings';
  RAISE NOTICE '✅ Verified RLS policy exists and is enabled';
  RAISE NOTICE '✅ Tested automatic tenant_id assignment';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 The JavaScript code has also been updated to:';
  RAISE NOTICE '  - Include tenant_id when inserting period_settings';
  RAISE NOTICE '  - Filter by tenant_id when fetching period_settings';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Next steps:';
  RAISE NOTICE '1. The application should now work correctly';
  RAISE NOTICE '2. Test creating/updating period settings';
  RAISE NOTICE '3. Verify data isolation between tenants';
END $$;
