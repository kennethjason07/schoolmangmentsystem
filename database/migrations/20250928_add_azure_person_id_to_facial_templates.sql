-- Add Azure person ID support to facial_templates
-- This aligns the DB schema with code that inserts/selects azure_person_id

ALTER TABLE public.facial_templates
  ADD COLUMN IF NOT EXISTS azure_person_id text;

-- Optional: index to speed up lookups by tenant and azure person id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_facial_templates_azure_person_tenant'
  ) THEN
    CREATE INDEX idx_facial_templates_azure_person_tenant
      ON public.facial_templates(tenant_id, azure_person_id)
      WHERE azure_person_id IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.facial_templates.azure_person_id IS 'Azure Face API personId for this template (nullable).';

-- Optional: ask PostgREST to reload schema (if you have permissions)
-- NOTIFY pgrst, 'reload schema';
