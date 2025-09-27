-- Add Warden Role to All Tenants
-- This script adds the Warden role with role_id = 5 to all existing tenants
-- Run this after creating the hostel system schema

-- Insert Warden role for all existing tenants
INSERT INTO public.roles (id, role_name, tenant_id)
SELECT 
    5 as id, 
    'Warden' as role_name, 
    t.id as tenant_id
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.tenant_id = t.id AND r.id = 5
);

-- Verify the insertion
SELECT 
    t.name as tenant_name,
    r.id as role_id,
    r.role_name,
    r.tenant_id
FROM public.tenants t
JOIN public.roles r ON t.id = r.tenant_id
WHERE r.id = 5
ORDER BY t.name;

-- Display success message
SELECT 'Warden role (ID: 5) added to all tenants successfully!' as message;

-- Optional: Create some sample warden users (uncomment if needed)
/*
-- Example warden user creation - modify as needed
INSERT INTO public.users (email, role_id, full_name, phone, tenant_id)
SELECT 
    'warden@' || LOWER(REPLACE(t.name, ' ', '')) || '.com' as email,
    5 as role_id,
    t.name || ' Warden' as full_name,
    '9999999999' as phone,
    t.id as tenant_id
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.tenant_id = t.id AND u.role_id = 5
);
*/