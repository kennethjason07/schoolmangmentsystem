-- Fix the roles table to allow multiple Admin roles (one per tenant)
-- This removes the global unique constraint and adds a proper composite constraint

-- Step 1: Drop the existing unique constraint on role_name
ALTER TABLE roles DROP CONSTRAINT roles_role_name_key;

-- Step 2: Add a composite unique constraint on (role_name, tenant_id)
-- This allows the same role name in different tenants
ALTER TABLE roles ADD CONSTRAINT roles_role_name_tenant_id_key UNIQUE (role_name, tenant_id);

-- Now each tenant can have its own "Admin" role
