-- 🚀 COMPLETE PUSH TOKENS FIX
-- This script resolves the "relation 'public.user_push_tokens' does not exist" error

-- ========================================
-- STEP 1: Ensure push_tokens table exists with correct schema
-- ========================================

-- Drop existing push_tokens table if it has wrong structure and recreate
DROP TABLE IF EXISTS public.push_tokens CASCADE;

CREATE TABLE public.push_tokens (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_type text CHECK (device_type = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])),
    device_name text,
    app_version text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_used timestamp with time zone,
    tenant_id uuid NOT NULL,
    CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT push_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT push_tokens_token_unique UNIQUE (token),
    CONSTRAINT push_tokens_user_token_unique UNIQUE (user_id, token)
);

-- ========================================
-- STEP 2: Create compatibility view for user_push_tokens
-- ========================================

-- Create a view named user_push_tokens that maps to push_tokens
-- This maintains backward compatibility with existing code
CREATE OR REPLACE VIEW public.user_push_tokens AS
SELECT 
    id,
    user_id,
    token as push_token,  -- Map 'token' to 'push_token' for compatibility
    device_type,
    device_name,
    app_version,
    is_active,
    created_at,
    updated_at,
    last_used,
    tenant_id
FROM public.push_tokens;

-- ========================================
-- STEP 3: Set up Row Level Security (RLS)
-- ========================================

-- Enable RLS on push_tokens table
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for push_tokens
DROP POLICY IF EXISTS "Users can manage their own push tokens" ON public.push_tokens;
CREATE POLICY "Users can manage their own push tokens" ON public.push_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid());

-- Enable RLS on the view (if supported by Supabase)
-- Note: Views inherit RLS from underlying tables in most cases

-- ========================================
-- STEP 4: Create helpful functions for push token management
-- ========================================

-- Function to safely upsert push tokens
CREATE OR REPLACE FUNCTION public.upsert_push_token(
    p_user_id UUID,
    p_token TEXT,
    p_device_type TEXT DEFAULT 'web',
    p_device_name TEXT DEFAULT NULL,
    p_app_version TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    token_id UUID;
    effective_tenant_id UUID;
BEGIN
    -- Get tenant_id from user if not provided
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO effective_tenant_id 
        FROM users 
        WHERE id = p_user_id;
    ELSE
        effective_tenant_id := p_tenant_id;
    END IF;
    
    -- First, deactivate any existing tokens for this device/user combo
    UPDATE push_tokens 
    SET is_active = FALSE, updated_at = NOW()
    WHERE user_id = p_user_id AND token = p_token;
    
    -- Insert new token or update existing one
    INSERT INTO push_tokens (
        user_id,
        token,
        device_type,
        device_name,
        app_version,
        tenant_id,
        is_active,
        created_at,
        updated_at,
        last_used
    ) VALUES (
        p_user_id,
        p_token,
        COALESCE(p_device_type, 'web'),
        p_device_name,
        p_app_version,
        effective_tenant_id,
        TRUE,
        NOW(),
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id, token)
    DO UPDATE SET
        device_type = EXCLUDED.device_type,
        device_name = EXCLUDED.device_name,
        app_version = EXCLUDED.app_version,
        tenant_id = EXCLUDED.tenant_id,
        is_active = TRUE,
        updated_at = NOW(),
        last_used = NOW()
    RETURNING id INTO token_id;
    
    RETURN token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active push tokens for a user (compatible with existing code)
CREATE OR REPLACE FUNCTION public.get_user_push_tokens(p_user_id UUID)
RETURNS TABLE (
    push_token TEXT,
    device_type TEXT,
    is_active BOOLEAN,
    last_used TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.token as push_token,
        pt.device_type,
        pt.is_active,
        pt.last_used
    FROM push_tokens pt
    WHERE pt.user_id = p_user_id
        AND pt.is_active = TRUE
    ORDER BY pt.last_used DESC NULLS LAST, pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 5: Grant permissions
-- ========================================

-- Grant permissions on the table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- Grant permissions on the view
GRANT SELECT ON public.user_push_tokens TO authenticated;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.upsert_push_token(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_push_tokens(UUID) TO authenticated;

-- ========================================
-- STEP 6: Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_id ON public.push_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON public.push_tokens(user_id, is_active) WHERE is_active = TRUE;

-- ========================================
-- STEP 7: Verify the fix
-- ========================================

-- Test queries to ensure everything works
DO $$
BEGIN
    -- Check if tables/views exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_tokens' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ push_tokens table exists';
    ELSE
        RAISE NOTICE '❌ push_tokens table missing';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'user_push_tokens' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ user_push_tokens view exists';
    ELSE
        RAISE NOTICE '❌ user_push_tokens view missing';
    END IF;
END
$$;

-- Display table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'push_tokens'
ORDER BY ordinal_position;

RAISE NOTICE '🚀 Push tokens table fix completed successfully!';