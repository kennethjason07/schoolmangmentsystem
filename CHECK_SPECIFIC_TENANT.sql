-- Check UPI settings for the specific tenant from the transaction
-- tenant_id: b8f8b5f0-1234-4567-8901-123456789000

SELECT 
  'UPI Settings for Tenant b8f8b5f0-1234-4567-8901-123456789000' as info,
  id,
  upi_id,
  upi_name,
  is_primary,
  is_active,
  created_at,
  created_by
FROM public.school_upi_settings 
WHERE tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
ORDER BY is_primary DESC, created_at DESC;

-- Check if this tenant exists in the tenants table
SELECT 
  'Tenant Info' as info,
  id,
  name,
  status
FROM public.tenants 
WHERE id = 'b8f8b5f0-1234-4567-8901-123456789000';
