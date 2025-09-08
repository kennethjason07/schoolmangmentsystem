-- ============================================
-- COMPLETE DATABASE SETUP FOR ONBOARDING
-- Run this in Supabase SQL Editor
-- ============================================

-- Function to create tenant with admin user (bypasses RLS)
CREATE OR REPLACE FUNCTION create_tenant_with_admin(
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
SECURITY DEFINER  -- This allows the function to bypass RLS
AS $$
DECLARE
    tenant_id UUID;
    role_id INTEGER;
    result JSONB;
BEGIN
    -- Check if subdomain already exists
    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = create_tenant_with_admin.subdomain) THEN
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
        tenant_name, create_tenant_with_admin.subdomain, contact_email, contact_phone, address_text,
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
        'subdomain', create_tenant_with_admin.subdomain,
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

-- Function to create user record after auth signup (bypasses RLS)
CREATE OR REPLACE FUNCTION create_user_record(
    user_id UUID,
    email_address TEXT,
    full_name_val TEXT,
    phone_number TEXT,
    tenant_id_val UUID,
    role_id_val INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- This allows the function to bypass RLS
AS $$
DECLARE
    result JSONB;
    user_record RECORD;
BEGIN
    -- Insert user record
    INSERT INTO users (
        id, email, full_name, phone, tenant_id, role_id, created_at
    ) VALUES (
        user_id, email_address, full_name_val, phone_number, tenant_id_val, role_id_val, NOW()
    ) RETURNING * INTO user_record;
    
    -- Return success with user data
    RETURN jsonb_build_object(
        'success', true,
        'data', row_to_json(user_record),
        'message', 'User record created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create user record: ' || SQLERRM
        );
END;
$$;

-- Grant execute permissions to anon and authenticated users
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO anon;
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_record TO anon;
GRANT EXECUTE ON FUNCTION create_user_record TO authenticated;

-- Create a policy that allows users to insert their own records after auth signup
-- This is a fallback in case the stored function approach doesn't work
CREATE POLICY "Users can insert their own records during signup" ON users
    FOR INSERT WITH CHECK (
        auth.uid() = id
    );

-- Allow authenticated users to read their own user records
CREATE POLICY "Users can read their own records" ON users
    FOR SELECT USING (
        auth.uid() = id
    );

-- Allow users to update their own records
CREATE POLICY "Users can update their own records" ON users
    FOR UPDATE USING (
        auth.uid() = id
    );

-- Test the functions (optional)
/*
SELECT create_tenant_with_admin(
    'Test School',
    'testschool999',
    'test@example.com',
    '+1234567890',
    '123 Test Street',
    'basic',
    'Asia/Kolkata',
    500,
    50,
    20,
    4,
    '{"fees": true, "exams": true, "messaging": true, "attendance": true}',
    'admin@test.com',
    'dummy_password',
    'Test Administrator'
);
*/
