-- Fix tenant_id issues for events table
-- Run this script in your Supabase SQL editor

-- 1. Create a default tenant if it doesn't exist
INSERT INTO public.tenants (id, name, created_at, updated_at)
VALUES (
    'default-tenant',
    'Default School',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
)
ON CONFLICT (id) DO NOTHING;

-- 2. Alternative: Make tenant_id nullable temporarily (if you prefer)
-- ALTER TABLE public.events ALTER COLUMN tenant_id DROP NOT NULL;

-- 3. Alternative: Remove foreign key constraint temporarily (if you prefer)
-- ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_tenant_id_fkey;

-- 4. Update existing events without tenant_id to use default tenant
UPDATE public.events 
SET tenant_id = 'default-tenant' 
WHERE tenant_id IS NULL;

-- 5. Create or update the default user's tenant_id if needed
-- Replace 'your-user-email@example.com' with your actual admin email
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"tenant_id": "default-tenant"}'::jsonb
WHERE email = 'your-user-email@example.com';

-- 6. Also update users table if it exists
UPDATE public.users 
SET tenant_id = 'default-tenant' 
WHERE tenant_id IS NULL;

-- 7. Grant permissions for the events table
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.tenants TO authenticated;

-- Verify the changes
SELECT 
    'Events with tenant_id' as table_info,
    COUNT(*) as count,
    tenant_id
FROM public.events 
GROUP BY tenant_id
UNION ALL
SELECT 
    'Tenants' as table_info,
    COUNT(*) as count,
    id as tenant_id
FROM public.tenants
GROUP BY id;
