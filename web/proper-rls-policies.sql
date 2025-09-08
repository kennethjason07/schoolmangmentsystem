-- PROPER RLS POLICIES FOR USER SIGNUP FLOW
-- Run this in Supabase SQL Editor

-- First, make sure RLS is enabled on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies (if any)
DROP POLICY IF EXISTS "Users can insert their own records during signup" ON users;
DROP POLICY IF EXISTS "Users can read their own records" ON users;
DROP POLICY IF EXISTS "Users can update their own records" ON users;

-- Policy 1: Allow users to insert their own record during signup
-- This is key - it allows the auth user to create their own user record
CREATE POLICY "Allow user self-insert during signup" ON users
    FOR INSERT WITH CHECK (
        auth.uid() = id
    );

-- Policy 2: Allow users to read their own records
CREATE POLICY "Users can read own records" ON users
    FOR SELECT USING (
        auth.uid() = id OR
        -- Allow service role to read all records (for admin operations)
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Policy 3: Allow users to update their own records
CREATE POLICY "Users can update own records" ON users
    FOR UPDATE USING (
        auth.uid() = id
    );

-- Policy 4: Allow service role to do everything (for admin operations)
CREATE POLICY "Service role full access" ON users
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Create the stored functions if they don't exist
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_user_record TO anon;
GRANT EXECUTE ON FUNCTION create_user_record TO authenticated;

-- Test the setup
SELECT 'RLS policies and functions created successfully' as status;
