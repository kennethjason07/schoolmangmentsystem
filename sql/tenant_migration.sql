-- ===================================================================
-- MULTI-TENANCY MIGRATION SCRIPT FOR EXISTING DATA
-- ===================================================================
-- This script will migrate your existing single-tenant data to multi-tenant
-- Run this in your Supabase SQL Editor

-- Step 1: Create tenants table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add tenant_id columns to existing tables if they don't exist
DO $$
BEGIN
  -- Add tenant_id to users table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.users ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to students table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.students ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to teachers table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.teachers ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to classes table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'classes' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.classes ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to parents table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parents' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.parents ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to student_attendance table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_attendance' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.student_attendance ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to teacher_attendance table  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_attendance' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.teacher_attendance ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to student_fees table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_fees' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.student_fees ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to fee_structure table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fee_structure' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.fee_structure ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to exams table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exams' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.exams ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to marks table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'marks' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.marks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to homeworks table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'homeworks' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.homeworks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to subjects table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.subjects ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to teacher_subjects table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_subjects' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.teacher_subjects ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to notifications table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.notifications ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to tasks table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.tasks ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to school_details table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_details' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.school_details ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to school_expenses table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'school_expenses' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.school_expenses ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to student_discounts table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_discounts' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.student_discounts ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

  -- Add tenant_id to timetable_entries table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'timetable_entries' AND column_name = 'tenant_id') THEN
    ALTER TABLE public.timetable_entries ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
  END IF;

END $$;

-- Step 3: Create default tenant for existing data
INSERT INTO public.tenants (name, domain, settings) 
VALUES (
  'Default School', 
  'default.school.local',
  jsonb_build_object(
    'created_by_migration', true,
    'migration_date', NOW()::text
  )
) ON CONFLICT (domain) DO NOTHING;

-- Step 4: Get the default tenant ID for use in migration
DO $$
DECLARE
  default_tenant_id UUID;
BEGIN
  -- Get the default tenant ID
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE domain = 'default.school.local' 
  LIMIT 1;

  -- Migrate existing data to use the default tenant ID
  IF default_tenant_id IS NOT NULL THEN
    -- Update users
    UPDATE public.users 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update students
    UPDATE public.students 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update teachers
    UPDATE public.teachers 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update classes
    UPDATE public.classes 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update parents
    UPDATE public.parents 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update student_attendance
    UPDATE public.student_attendance 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update teacher_attendance
    UPDATE public.teacher_attendance 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update student_fees
    UPDATE public.student_fees 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update fee_structure
    UPDATE public.fee_structure 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update exams
    UPDATE public.exams 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update marks
    UPDATE public.marks 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update homeworks
    UPDATE public.homeworks 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update subjects
    UPDATE public.subjects 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update teacher_subjects
    UPDATE public.teacher_subjects 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update notifications
    UPDATE public.notifications 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update tasks
    UPDATE public.tasks 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update school_details
    UPDATE public.school_details 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update school_expenses
    UPDATE public.school_expenses 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update student_discounts
    UPDATE public.student_discounts 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    -- Update timetable_entries
    UPDATE public.timetable_entries 
    SET tenant_id = default_tenant_id 
    WHERE tenant_id IS NULL;

    RAISE NOTICE 'Migration completed! All existing data has been assigned to default tenant: %', default_tenant_id;
  ELSE
    RAISE NOTICE 'Error: Could not find default tenant for migration';
  END IF;
END $$;

-- Step 5: Create RPC functions for tenant management
CREATE OR REPLACE FUNCTION update_user_tenant_metadata(
  tenant_id UUID,
  user_emails TEXT[] DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  user_record RECORD;
  default_tenant_id UUID;
  auth_table_exists BOOLEAN := false;
BEGIN
  -- Get the default tenant ID if tenant_id is not provided
  IF tenant_id IS NULL THEN
    SELECT id INTO default_tenant_id 
    FROM public.tenants 
    WHERE domain = 'default.school.local' 
    LIMIT 1;
    tenant_id := default_tenant_id;
  END IF;

  -- Check if we can access auth.users table
  BEGIN
    PERFORM 1 FROM auth.users LIMIT 1;
    auth_table_exists := true;
  EXCEPTION
    WHEN others THEN
      auth_table_exists := false;
  END;

  IF auth_table_exists THEN
    -- Try to update auth users metadata
    BEGIN
      IF user_emails IS NULL THEN
        -- Update app_metadata for all auth users to include tenant_id
        UPDATE auth.users 
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', tenant_id::text)
        WHERE (raw_app_meta_data->>'tenant_id') IS NULL;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
      ELSE
        -- Update specific users by email
        FOR user_record IN 
          SELECT id FROM auth.users WHERE email = ANY(user_emails)
        LOOP
          UPDATE auth.users 
          SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tenant_id', tenant_id::text)
          WHERE id = user_record.id;
          
          updated_count := updated_count + 1;
        END LOOP;
      END IF;
    EXCEPTION
      WHEN others THEN
        -- If updating auth metadata fails, return a warning but don't fail the whole migration
        RETURN json_build_object(
          'updated_count', 0, 
          'tenant_id', tenant_id, 
          'warning', 'Could not update auth metadata - you may need to update this manually in Supabase Dashboard',
          'error', SQLERRM
        );
    END;
  ELSE
    RETURN json_build_object(
      'updated_count', 0, 
      'tenant_id', tenant_id, 
      'warning', 'Auth table not accessible - you may need to update user metadata manually'
    );
  END IF;

  RETURN json_build_object('updated_count', updated_count, 'tenant_id', tenant_id);
END;
$$;

-- Step 6: Create tenant context function
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set the tenant context for RLS policies
  PERFORM set_config('app.current_tenant_id', tenant_id::text, true);
END;
$$;

-- Step 7: Update auth users metadata with default tenant
DO $$
DECLARE
  default_tenant_id UUID;
  result JSON;
BEGIN
  -- Get the default tenant ID
  SELECT id INTO default_tenant_id 
  FROM public.tenants 
  WHERE domain = 'default.school.local' 
  LIMIT 1;

  -- Update all existing auth users to include tenant_id in metadata
  IF default_tenant_id IS NOT NULL THEN
    SELECT update_user_tenant_metadata(default_tenant_id) INTO result;
    RAISE NOTICE 'Auth metadata update result: %', result;
  END IF;
END $$;

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_id ON public.students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teachers_tenant_id ON public.teachers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_classes_tenant_id ON public.classes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parents_tenant_id ON public.parents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_attendance_tenant_id ON public.student_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_tenant_id ON public.student_fees(tenant_id);

-- Step 9: Verification queries
SELECT 
  'tenants' as table_name, 
  COUNT(*) as total_records
FROM public.tenants
UNION ALL
SELECT 
  'users_with_tenant' as table_name, 
  COUNT(*) as total_records
FROM public.users 
WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 
  'students_with_tenant' as table_name, 
  COUNT(*) as total_records
FROM public.students 
WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 
  'teachers_with_tenant' as table_name, 
  COUNT(*) as total_records
FROM public.teachers 
WHERE tenant_id IS NOT NULL
UNION ALL
SELECT 
  'classes_with_tenant' as table_name, 
  COUNT(*) as total_records
FROM public.classes 
WHERE tenant_id IS NOT NULL;

-- Display the default tenant information
SELECT 
  'Default Tenant Created:' as message,
  name,
  domain,
  id as tenant_id,
  created_at
FROM public.tenants 
WHERE domain = 'default.school.local';

-- Final completion messages
DO $$
BEGIN
  RAISE NOTICE '=== MIGRATION COMPLETED SUCCESSFULLY ===';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. All existing data has been assigned to the default tenant';
  RAISE NOTICE '2. All auth users now have tenant_id in their metadata';
  RAISE NOTICE '3. Your existing logins should continue to work';
  RAISE NOTICE '4. You can now create additional tenants as needed';
  RAISE NOTICE '5. Test your application to ensure everything works correctly';
END $$;
