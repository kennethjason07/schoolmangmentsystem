-- ===================================================================
-- CREATE MISSING PUSH_TOKENS TABLE
-- ===================================================================
-- This table is required for push notifications to work properly
-- Execute this in your Supabase SQL Editor
-- ===================================================================

-- Create push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
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
  CONSTRAINT push_tokens_user_device_unique UNIQUE (user_id, device_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant_id ON public.push_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON public.push_tokens(user_id, is_active);

-- Add comments for documentation
COMMENT ON TABLE public.push_tokens IS 'Stores push notification tokens for mobile and web devices';
COMMENT ON COLUMN public.push_tokens.token IS 'Expo push token or FCM token for the device';
COMMENT ON COLUMN public.push_tokens.device_type IS 'Type of device: ios, android, or web';
COMMENT ON COLUMN public.push_tokens.is_active IS 'Whether this token is still valid and should receive notifications';
COMMENT ON COLUMN public.push_tokens.last_used IS 'Last time this token was used to send a notification';

-- Create RLS (Row Level Security) policies
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tokens
CREATE POLICY "Users can view own push tokens" ON public.push_tokens
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own tokens
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own tokens
CREATE POLICY "Users can update own push tokens" ON public.push_tokens
  FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own tokens
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- Policy: Service role can manage all tokens (for admin operations)
CREATE POLICY "Service role full access" ON public.push_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- ===================================================================
-- OPTIONAL: Insert sample data for testing
-- ===================================================================
-- Uncomment the following if you want to add sample push tokens for testing
-- Replace the UUIDs with actual user IDs from your system

/*
-- Sample push tokens for testing (replace with real user IDs)
INSERT INTO public.push_tokens (user_id, token, device_type, device_name, tenant_id) VALUES
  (
    '00000000-0000-0000-0000-000000000001', -- Replace with real admin user ID
    'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', -- Sample Expo token format
    'android',
    'Admin Phone',
    'b8f8b5f0-1234-4567-8901-123456789000' -- Replace with your tenant ID
  ),
  (
    '00000000-0000-0000-0000-000000000002', -- Replace with real teacher user ID
    'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]', -- Sample Expo token format
    'ios',
    'Teacher iPhone',
    'b8f8b5f0-1234-4567-8901-123456789000' -- Replace with your tenant ID
  )
ON CONFLICT (token) DO NOTHING;
*/

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ push_tokens table created successfully!';
  RAISE NOTICE '📱 Push notifications will now work properly';
  RAISE NOTICE '🔧 You can now register device tokens from your mobile app';
END $$;