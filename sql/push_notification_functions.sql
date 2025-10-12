-- Push Notification Database Functions
-- These functions provide efficient push token management with proper tenant isolation

-- Function to create or update push token for a user
CREATE OR REPLACE FUNCTION upsert_push_token(
    p_user_id UUID,
    p_user_type TEXT,
    p_token TEXT,
    p_platform TEXT,
    p_device_info JSONB DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    token_id UUID;
BEGIN
    -- First, deactivate any existing tokens for this device
    UPDATE push_tokens 
    SET is_active = FALSE, updated_at = NOW()
    WHERE user_id = p_user_id AND token = p_token;
    
    -- Insert new token or update existing one
    INSERT INTO push_tokens (
        user_id,
        user_type,
        token,
        platform,
        device_info,
        tenant_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_user_type,
        p_token,
        p_platform,
        COALESCE(p_device_info, '{}'::jsonb),
        p_tenant_id,
        TRUE,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, token)
    DO UPDATE SET
        user_type = EXCLUDED.user_type,
        platform = EXCLUDED.platform,
        device_info = EXCLUDED.device_info,
        tenant_id = EXCLUDED.tenant_id,
        is_active = TRUE,
        updated_at = NOW()
    RETURNING id INTO token_id;
    
    RETURN token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active push tokens for a user with tenant filtering
CREATE OR REPLACE FUNCTION get_user_push_tokens(
    p_user_id UUID,
    p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE (
    token TEXT,
    platform TEXT,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.token,
        pt.platform,
        pt.device_info,
        pt.created_at
    FROM push_tokens pt
    WHERE pt.user_id = p_user_id
        AND pt.is_active = TRUE
        AND (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
    ORDER BY pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get multiple users' push tokens efficiently
CREATE OR REPLACE FUNCTION get_bulk_push_tokens(
    p_user_ids UUID[],
    p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE (
    user_id UUID,
    token TEXT,
    platform TEXT,
    device_info JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.user_id,
        pt.token,
        pt.platform,
        pt.device_info
    FROM push_tokens pt
    WHERE pt.user_id = ANY(p_user_ids)
        AND pt.is_active = TRUE
        AND (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
    ORDER BY pt.user_id, pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate push tokens for a user (on logout)
CREATE OR REPLACE FUNCTION deactivate_user_push_tokens(
    p_user_id UUID,
    p_token TEXT DEFAULT NULL -- If provided, only deactivate this specific token
) RETURNS INTEGER AS $$
DECLARE
    affected_count INTEGER;
BEGIN
    IF p_token IS NOT NULL THEN
        -- Deactivate specific token
        UPDATE push_tokens 
        SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = p_user_id AND token = p_token;
    ELSE
        -- Deactivate all tokens for user
        UPDATE push_tokens 
        SET is_active = FALSE, updated_at = NOW()
        WHERE user_id = p_user_id AND is_active = TRUE;
    END IF;
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old/inactive tokens (maintenance function)
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens(
    p_days_old INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete tokens that are inactive and older than specified days
    DELETE FROM push_tokens
    WHERE is_active = FALSE 
        AND updated_at < (NOW() - INTERVAL '%s days' || p_days_old);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get push token statistics
CREATE OR REPLACE FUNCTION get_push_token_stats(
    p_tenant_id UUID DEFAULT NULL
) RETURNS TABLE (
    total_tokens BIGINT,
    active_tokens BIGINT,
    inactive_tokens BIGINT,
    platform_stats JSONB,
    user_type_stats JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_tokens,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active_tokens,
        COUNT(*) FILTER (WHERE is_active = FALSE) as inactive_tokens,
        jsonb_object_agg(platform, platform_count) as platform_stats,
        jsonb_object_agg(user_type, user_type_count) as user_type_stats
    FROM (
        SELECT 
            pt.platform,
            pt.user_type,
            COUNT(*) as platform_count,
            COUNT(*) as user_type_count
        FROM push_tokens pt
        WHERE (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
            AND pt.is_active = TRUE
        GROUP BY pt.platform, pt.user_type
    ) stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has notification settings enabled
CREATE OR REPLACE FUNCTION is_notification_enabled(
    p_user_id UUID,
    p_notification_type TEXT DEFAULT 'chat_messages'
) RETURNS BOOLEAN AS $$
DECLARE
    is_enabled BOOLEAN;
BEGIN
    -- Check user notification settings
    SELECT 
        CASE 
            WHEN p_notification_type = 'chat_messages' THEN COALESCE(chat_messages, TRUE)
            WHEN p_notification_type = 'formal_notifications' THEN COALESCE(formal_notifications, TRUE)
            WHEN p_notification_type = 'urgent_notifications' THEN COALESCE(urgent_notifications, TRUE)
            ELSE TRUE
        END INTO is_enabled
    FROM user_notification_settings
    WHERE user_id = p_user_id;
    
    -- Default to enabled if no settings found
    RETURN COALESCE(is_enabled, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recipients with their push tokens for efficient bulk notifications
CREATE OR REPLACE FUNCTION get_notification_recipients_with_tokens(
    p_recipient_ids UUID[],
    p_tenant_id UUID DEFAULT NULL,
    p_notification_type TEXT DEFAULT 'chat_messages'
) RETURNS TABLE (
    recipient_id UUID,
    recipient_name TEXT,
    recipient_email TEXT,
    tokens JSONB,
    is_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as recipient_id,
        COALESCE(u.full_name, u.email) as recipient_name,
        u.email as recipient_email,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'token', pt.token,
                    'platform', pt.platform,
                    'device_info', pt.device_info
                )
            ) FILTER (WHERE pt.token IS NOT NULL),
            '[]'::jsonb
        ) as tokens,
        COALESCE(
            CASE 
                WHEN p_notification_type = 'chat_messages' THEN COALESCE(uns.chat_messages, TRUE)
                WHEN p_notification_type = 'formal_notifications' THEN COALESCE(uns.formal_notifications, TRUE)
                WHEN p_notification_type = 'urgent_notifications' THEN COALESCE(uns.urgent_notifications, TRUE)
                ELSE TRUE
            END,
            TRUE
        ) as is_enabled
    FROM users u
    LEFT JOIN push_tokens pt ON u.id = pt.user_id 
        AND pt.is_active = TRUE
        AND (p_tenant_id IS NULL OR pt.tenant_id = p_tenant_id)
    LEFT JOIN user_notification_settings uns ON u.id = uns.user_id
    WHERE u.id = ANY(p_recipient_ids)
        AND (p_tenant_id IS NULL OR u.tenant_id = p_tenant_id)
    GROUP BY u.id, u.full_name, u.email, uns.chat_messages, uns.formal_notifications, uns.urgent_notifications;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log notification delivery attempts
CREATE OR REPLACE FUNCTION log_notification_delivery(
    p_user_id UUID,
    p_notification_type TEXT,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT NULL,
    p_status TEXT DEFAULT 'pending', -- pending, sent, failed
    p_error_message TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO notification_delivery_log (
        id,
        user_id,
        notification_type,
        title,
        body,
        data,
        status,
        error_message,
        tenant_id,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        p_notification_type,
        p_title,
        p_body,
        COALESCE(p_data, '{}'::jsonb),
        p_status,
        p_error_message,
        p_tenant_id,
        NOW(),
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION upsert_push_token(UUID, TEXT, TEXT, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_push_tokens(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_bulk_push_tokens(UUID[], UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION deactivate_user_push_tokens(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_notification_enabled(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_recipients_with_tokens(UUID[], UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_notification_delivery(UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, UUID) TO authenticated;

-- Grant maintenance functions to service_role only
GRANT EXECUTE ON FUNCTION cleanup_old_push_tokens(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_push_token_stats(UUID) TO service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_tokens(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant ON push_tokens(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_notification_settings_user ON user_notification_settings(user_id);

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_type TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    device_info JSONB DEFAULT '{}'::jsonb,
    tenant_id UUID REFERENCES tenants(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token)
);

CREATE TABLE IF NOT EXISTS user_notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    chat_messages BOOLEAN DEFAULT TRUE,
    formal_notifications BOOLEAN DEFAULT TRUE,
    urgent_notifications BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies for push tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens" ON push_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- Add RLS policies for user notification settings
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification settings" ON user_notification_settings
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- Add RLS policies for notification delivery log
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification logs" ON notification_delivery_log
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage notification logs" ON notification_delivery_log
    FOR ALL TO service_role
    USING (TRUE);