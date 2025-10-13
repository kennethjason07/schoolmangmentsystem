-- 🚨 PUSH TOKENS TABLE REFERENCE FIX
-- Problem: Code is trying to query 'user_push_tokens' table but schema shows 'push_tokens'
-- This SQL fixes the table structure to match the expected naming

-- Option 1: Create a view to maintain backward compatibility
CREATE OR REPLACE VIEW user_push_tokens AS
SELECT 
    id,
    user_id,
    token as push_token,
    device_type,
    device_name,
    app_version,
    is_active,
    created_at,
    updated_at,
    last_used,
    tenant_id
FROM push_tokens;

-- Option 2: Grant permissions to the view
GRANT SELECT ON user_push_tokens TO authenticated;

-- Option 3: Add RLS policy to the view
CREATE POLICY "Users can view their own push tokens via view" ON user_push_tokens
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Verify the fix
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE tablename IN ('push_tokens', 'user_push_tokens')
ORDER BY tablename;