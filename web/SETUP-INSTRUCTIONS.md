# Setup Instructions for Simple Onboarding

To fix the "Row-Level Security policy violation" error, you need to create a database function that can bypass RLS for tenant creation.

## Step 1: Run the SQL Function

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `create-tenant-function.sql`
4. Click **Run** to create the function

**OR**

Run this SQL directly in your Supabase SQL editor:

```sql
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
    -- Create tenant
    INSERT INTO tenants (
        name, subdomain, contact_email, contact_phone, address,
        subscription_plan, timezone, max_students, max_teachers, max_classes,
        academic_year_start_month, features, status
    ) VALUES (
        tenant_name, subdomain, contact_email, contact_phone, address_text,
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
        'message', 'Tenant and admin role created successfully'
    ) INTO result;
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create tenant'
        );
END;
$$;

-- Grant execute permission to anon role (for web signups)
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO anon;
GRANT EXECUTE ON FUNCTION create_tenant_with_admin TO authenticated;
```

## Step 2: Test the Onboarding

1. Open `simple-onboarding.html` in your browser
2. Enter an email and password
3. The system should now work without RLS errors!

## How It Works

- **SECURITY DEFINER**: The function runs with the privileges of the function owner (bypasses RLS)
- **Atomic Operation**: Creates tenant, role, and school details in a single transaction
- **Error Handling**: Returns structured JSON response for success/failure
- **Permissions**: Granted to `anon` role so web users can execute it

## Alternative Setup (If function approach doesn't work)

If you prefer not to use the stored function approach, you can temporarily disable RLS on the tenants table during onboarding:

```sql
-- Temporarily disable RLS for tenant creation (NOT RECOMMENDED for production)
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

-- Re-enable after testing (IMPORTANT!)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
```

**Warning**: Only use this for testing. In production, always use the stored function approach for security.

## Troubleshooting

### Function Not Found Error
- Make sure you ran the SQL in the correct database
- Check that the function was created: `\df create_tenant_with_admin` in SQL editor

### Permission Denied Error
- Make sure you granted execute permissions to `anon` role
- Check that your Supabase user has permission to create functions

### RLS Still Blocking
- Verify the function has `SECURITY DEFINER` 
- Check that RLS is enabled on the tables
- Make sure the function owner has bypass privileges

## Files Modified

- **`supabase-config.js`**: Updated to use `rpc()` call instead of direct insert
- **`simple-onboarding.js`**: No changes needed
- **`simple-onboarding.html`**: No changes needed

The simple onboarding form should now work properly with your multi-tenant setup!
