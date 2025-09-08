-- ============================================
-- STEP 1: Copy and paste this ENTIRE script into Supabase SQL Editor
-- STEP 2: Click "RUN" button
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

-- Grant execute permission to anon role (for web signups)
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO anon;
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO authenticated;

-- Test the function (optional - you can run this to test)
SELECT create_tenant_with_admin(
    'Test School',
    'testschool123',
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
