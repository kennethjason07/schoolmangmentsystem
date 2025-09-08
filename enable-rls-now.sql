-- ============================================
-- RUN THIS SQL IN SUPABASE TO RE-ENABLE RLS
-- Copy and paste this entire script into Supabase SQL Editor
-- ============================================

-- STEP 1: Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_details ENABLE ROW LEVEL SECURITY;

-- STEP 2: Create policies for TENANTS table
DROP POLICY IF EXISTS "Allow anon to create tenants" ON tenants;
DROP POLICY IF EXISTS "Users can read their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;

CREATE POLICY "Allow anon to create tenants" ON tenants
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Users can read their own tenant" ON tenants
FOR SELECT TO authenticated
USING (id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

CREATE POLICY "Users can update their own tenant" ON tenants
FOR UPDATE TO authenticated
USING (id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

-- STEP 3: Create policies for ROLES table
DROP POLICY IF EXISTS "Allow anon to create roles" ON roles;
DROP POLICY IF EXISTS "Users can read roles in their tenant" ON roles;

CREATE POLICY "Allow anon to create roles" ON roles
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Users can read roles in their tenant" ON roles
FOR SELECT TO authenticated
USING (tenant_id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

-- STEP 4: Create policies for USERS table
DROP POLICY IF EXISTS "Allow anon to create users" ON users;
DROP POLICY IF EXISTS "Users can read their own profile" ON users;
DROP POLICY IF EXISTS "Users can read users in their tenant" ON users;

CREATE POLICY "Allow anon to create users" ON users
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Users can read their own profile" ON users
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can read users in their tenant" ON users
FOR SELECT TO authenticated
USING (tenant_id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

-- STEP 5: Create policies for SCHOOL_DETAILS table
DROP POLICY IF EXISTS "Allow anon to create school details" ON school_details;
DROP POLICY IF EXISTS "Users can read their school details" ON school_details;
DROP POLICY IF EXISTS "Users can update their school details" ON school_details;

CREATE POLICY "Allow anon to create school details" ON school_details
FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Users can read their school details" ON school_details
FOR SELECT TO authenticated
USING (tenant_id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

CREATE POLICY "Users can update their school details" ON school_details
FOR UPDATE TO authenticated
USING (tenant_id::text = (auth.jwt() ->> 'user_metadata')::jsonb ->> 'tenant_id');

-- STEP 6: Create secure tenant creation function
DROP FUNCTION IF EXISTS create_tenant_with_admin_secure;

CREATE OR REPLACE FUNCTION create_tenant_with_admin_secure(
    tenant_name TEXT,
    subdomain TEXT,
    contact_email TEXT,
    contact_phone TEXT DEFAULT '',
    address_text TEXT DEFAULT '',
    subscription_plan TEXT DEFAULT 'basic',
    timezone_val TEXT DEFAULT 'Asia/Kolkata',
    max_students INTEGER DEFAULT 500,
    max_teachers INTEGER DEFAULT 50,
    max_classes INTEGER DEFAULT 20,
    academic_year_start_month INTEGER DEFAULT 4,
    features_json JSONB DEFAULT '{"fees": true, "exams": true, "messaging": true, "attendance": true}',
    admin_email TEXT,
    admin_password TEXT,
    admin_full_name TEXT DEFAULT 'Administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    tenant_id UUID;
    role_id INTEGER;
    result JSONB;
BEGIN
    -- Check if subdomain already exists
    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = create_tenant_with_admin_secure.subdomain) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subdomain already exists',
            'message', 'Please choose a different subdomain'
        );
    END IF;

    -- Create tenant
    INSERT INTO tenants (
        name, subdomain, contact_email, contact_phone, address,
        subscription_plan, timezone, max_students, max_teachers, max_classes,
        academic_year_start_month, features, status
    ) VALUES (
        tenant_name, create_tenant_with_admin_secure.subdomain, contact_email, contact_phone, address_text,
        subscription_plan, timezone_val, max_students, max_teachers, max_classes,
        academic_year_start_month, features_json, 'active'
    ) RETURNING id INTO tenant_id;
    
    -- Create admin role for this tenant
    INSERT INTO roles (role_name, tenant_id)
    VALUES ('Admin', tenant_id)
    RETURNING id INTO role_id;
    
    -- Create school details
    INSERT INTO school_details (
        tenant_id, name, type, address, phone, email
    ) VALUES (
        tenant_id, tenant_name, 'School', address_text, contact_phone, contact_email
    );
    
    -- Return result
    SELECT jsonb_build_object(
        'success', true,
        'tenant_id', tenant_id,
        'role_id', role_id,
        'subdomain', create_tenant_with_admin_secure.subdomain,
        'message', 'Tenant and admin role created successfully'
    ) INTO result;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create tenant: ' || SQLERRM
        );
END;
$$;

-- STEP 7: Grant permissions
GRANT EXECUTE ON FUNCTION create_tenant_with_admin_secure TO anon;
GRANT EXECUTE ON FUNCTION create_tenant_with_admin_secure TO authenticated;

-- DONE! RLS is now enabled with proper policies
