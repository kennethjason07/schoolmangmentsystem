-- Drop table if exists to recreate cleanly
DROP TABLE IF EXISTS public.school_upi_settings CASCADE;

-- Create school_upi_settings table for storing UPI IDs per tenant
CREATE TABLE public.school_upi_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  upi_id text NOT NULL,
  upi_name text NOT NULL,
  is_primary boolean DEFAULT false,
  is_active boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- Add foreign key constraints
ALTER TABLE public.school_upi_settings 
ADD CONSTRAINT school_upi_settings_tenant_id_fkey 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.school_upi_settings 
ADD CONSTRAINT school_upi_settings_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.users(id);

ALTER TABLE public.school_upi_settings 
ADD CONSTRAINT school_upi_settings_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES public.users(id);

-- Add check constraint for UPI ID format
ALTER TABLE public.school_upi_settings 
ADD CONSTRAINT school_upi_settings_upi_id_format 
CHECK (upi_id ~* '^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+$');

-- Create indexes for better performance
CREATE INDEX idx_school_upi_settings_tenant_id ON public.school_upi_settings(tenant_id);
CREATE INDEX idx_school_upi_settings_is_active ON public.school_upi_settings(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_school_upi_settings_is_primary ON public.school_upi_settings(tenant_id, is_primary) WHERE is_primary = true;

-- Unique constraint: Only one primary UPI ID per tenant
CREATE UNIQUE INDEX idx_unique_primary_upi_per_tenant 
ON public.school_upi_settings(tenant_id) 
WHERE is_primary = true;

-- Enable RLS on the table
ALTER TABLE public.school_upi_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access UPI settings for their own tenant
CREATE POLICY "Users can view school UPI settings for their tenant"
  ON public.school_upi_settings
  FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid()));

-- RLS Policy: Admin users can insert UPI settings for their tenant
CREATE POLICY "Admin can insert school UPI settings for their tenant"
  ON public.school_upi_settings
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u 
      JOIN public.roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() 
      AND r.role_name IN ('Admin', 'Super Admin')
    )
  );

-- RLS Policy: Admin users can update UPI settings for their tenant
CREATE POLICY "Admin can update school UPI settings for their tenant"
  ON public.school_upi_settings
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u 
      JOIN public.roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() 
      AND r.role_name IN ('Admin', 'Super Admin')
    )
  );

-- RLS Policy: Admin users can delete UPI settings for their tenant
CREATE POLICY "Admin can delete school UPI settings for their tenant"
  ON public.school_upi_settings
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE users.id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u 
      JOIN public.roles r ON u.role_id = r.id 
      WHERE u.id = auth.uid() 
      AND r.role_name IN ('Admin', 'Super Admin')
    )
  );

-- Function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION update_school_upi_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update the updated_at column
CREATE TRIGGER trigger_update_school_upi_settings_updated_at
  BEFORE UPDATE ON public.school_upi_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_school_upi_settings_updated_at();

-- Function to ensure only one primary UPI ID per tenant
CREATE OR REPLACE FUNCTION ensure_single_primary_upi()
RETURNS TRIGGER AS $$
BEGIN
  -- If this record is being set as primary
  IF NEW.is_primary = true THEN
    -- Unset any existing primary UPI IDs for this tenant
    UPDATE public.school_upi_settings 
    SET is_primary = false, updated_at = now(), updated_by = auth.uid()
    WHERE tenant_id = NEW.tenant_id 
    AND is_primary = true 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to ensure only one primary UPI ID per tenant
CREATE TRIGGER trigger_ensure_single_primary_upi
  BEFORE INSERT OR UPDATE ON public.school_upi_settings
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_upi();

-- Add the tenant_id foreign key constraint to upi_transactions table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'upi_transactions_tenant_id_fkey'
    AND table_name = 'upi_transactions'
  ) THEN
    ALTER TABLE public.upi_transactions 
    ADD CONSTRAINT upi_transactions_tenant_id_fkey 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE public.school_upi_settings IS 'Stores UPI payment settings for each school/tenant';
COMMENT ON COLUMN public.school_upi_settings.upi_id IS 'UPI ID for payments (format: user@bank)';
COMMENT ON COLUMN public.school_upi_settings.upi_name IS 'Display name for the UPI account';
COMMENT ON COLUMN public.school_upi_settings.is_primary IS 'Indicates if this is the primary/default UPI ID for the tenant';
COMMENT ON COLUMN public.school_upi_settings.is_active IS 'Whether this UPI ID is active and can be used for payments';
COMMENT ON COLUMN public.school_upi_settings.description IS 'Optional description or notes about this UPI account';
