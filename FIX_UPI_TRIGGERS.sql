-- Fix UPI triggers to handle auth.uid() properly
-- The issue is that the triggers are trying to set updated_by = auth.uid()
-- but auth.uid() returns a value that doesn't exist in the users table

-- Drop and recreate the update trigger function
DROP FUNCTION IF EXISTS update_school_upi_settings_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_school_upi_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Only set updated_by if auth.uid() exists in users table
  IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
    NEW.updated_by = auth.uid();
  ELSE
    -- Keep the existing updated_by value or set to NULL
    NEW.updated_by = COALESCE(OLD.updated_by, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_school_upi_settings_updated_at
  BEFORE UPDATE ON public.school_upi_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_school_upi_settings_updated_at();

-- Drop and recreate the primary UPI trigger function
DROP FUNCTION IF EXISTS ensure_single_primary_upi() CASCADE;

CREATE OR REPLACE FUNCTION ensure_single_primary_upi()
RETURNS TRIGGER AS $$
DECLARE
  update_by_user uuid;
BEGIN
  -- If this record is being set as primary
  IF NEW.is_primary = true THEN
    -- Determine who should be set as updated_by
    IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) THEN
      update_by_user := auth.uid();
    ELSE
      update_by_user := NULL;
    END IF;
    
    -- Unset any existing primary UPI IDs for this tenant
    UPDATE public.school_upi_settings 
    SET is_primary = false, 
        updated_at = now(), 
        updated_by = update_by_user
    WHERE tenant_id = NEW.tenant_id 
    AND is_primary = true 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_ensure_single_primary_upi
  BEFORE INSERT OR UPDATE ON public.school_upi_settings
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_upi();

-- Test the current user ID
SELECT 
  'Current auth.uid():' as info,
  auth.uid() as auth_uid,
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()) 
    THEN 'EXISTS in users table ✅'
    ELSE 'NOT FOUND in users table ❌'
  END as user_exists;
