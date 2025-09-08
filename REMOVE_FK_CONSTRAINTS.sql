-- Remove foreign key constraints that are causing issues
-- The created_by and updated_by fields should be optional references

-- Drop the problematic foreign key constraints
ALTER TABLE public.school_upi_settings 
DROP CONSTRAINT IF EXISTS school_upi_settings_created_by_fkey;

ALTER TABLE public.school_upi_settings 
DROP CONSTRAINT IF EXISTS school_upi_settings_updated_by_fkey;

-- Recreate the triggers to handle NULL auth.uid() gracefully
DROP FUNCTION IF EXISTS update_school_upi_settings_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_school_upi_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  -- Set updated_by to auth.uid() if it exists, otherwise leave as NULL
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trigger_update_school_upi_settings_updated_at
  BEFORE UPDATE ON public.school_upi_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_school_upi_settings_updated_at();

-- Fix the primary UPI trigger
DROP FUNCTION IF EXISTS ensure_single_primary_upi() CASCADE;

CREATE OR REPLACE FUNCTION ensure_single_primary_upi()
RETURNS TRIGGER AS $$
BEGIN
  -- If this record is being set as primary
  IF NEW.is_primary = true THEN
    -- Unset any existing primary UPI IDs for this tenant
    UPDATE public.school_upi_settings 
    SET is_primary = false, 
        updated_at = now(), 
        updated_by = auth.uid()
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

-- Verify the constraints are removed
SELECT 
  'Checking constraints' as info,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'school_upi_settings' 
  AND constraint_type = 'FOREIGN KEY'
ORDER BY constraint_name;
