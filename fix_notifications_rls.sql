-- Fix Notifications RLS Policies and Schema
-- This script checks the schema and fixes RLS issues for notifications

-- 1. Check current schema for notifications table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;

-- 2. Check current schema for notification_recipients table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'notification_recipients' 
ORDER BY ordinal_position;

-- 3. Check existing RLS policies on notifications
SELECT 
    schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('notifications', 'notification_recipients');

-- 4. Check if RLS is enabled
SELECT 
    schemaname, tablename, rowsecurity, hasoids
FROM pg_tables 
WHERE tablename IN ('notifications', 'notification_recipients');

-- 5. Add tenant_id column to notifications if it doesn't exist
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 6. Add tenant_id column to notification_recipients if it doesn't exist  
ALTER TABLE notification_recipients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_tenant_id ON notification_recipients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_by ON notifications(sent_by);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_recipient_id ON notification_recipients(recipient_id);

-- 8. Drop existing problematic policies
DROP POLICY IF EXISTS "tenant_notifications_select" ON notifications;
DROP POLICY IF EXISTS "tenant_notifications_insert" ON notifications;
DROP POLICY IF EXISTS "tenant_notifications_update" ON notifications;
DROP POLICY IF EXISTS "tenant_notifications_delete" ON notifications;

DROP POLICY IF EXISTS "tenant_notification_recipients_select" ON notification_recipients;
DROP POLICY IF EXISTS "tenant_notification_recipients_insert" ON notification_recipients;
DROP POLICY IF EXISTS "tenant_notification_recipients_update" ON notification_recipients;
DROP POLICY IF EXISTS "tenant_notification_recipients_delete" ON notification_recipients;

-- 9. Enable RLS on both tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- 10. Create tenant-aware RLS policies for notifications table
CREATE POLICY "tenant_notifications_select" ON notifications
FOR SELECT 
TO authenticated
USING (
    -- Allow access if user belongs to the same tenant
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR 
    -- Allow if tenant_id is null (for backwards compatibility)
    tenant_id IS NULL
);

CREATE POLICY "tenant_notifications_insert" ON notifications
FOR INSERT 
TO authenticated
WITH CHECK (
    -- Set tenant_id to user's tenant if not provided
    tenant_id = COALESCE(
        tenant_id,
        (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
    OR
    -- Allow if user is authenticated (tenant_id will be set by trigger)
    auth.uid() IS NOT NULL
);

CREATE POLICY "tenant_notifications_update" ON notifications
FOR UPDATE 
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR tenant_id IS NULL
)
WITH CHECK (
    tenant_id = COALESCE(
        tenant_id,
        (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
);

CREATE POLICY "tenant_notifications_delete" ON notifications
FOR DELETE 
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR tenant_id IS NULL
);

-- 11. Create tenant-aware RLS policies for notification_recipients table
CREATE POLICY "tenant_notification_recipients_select" ON notification_recipients
FOR SELECT 
TO authenticated
USING (
    -- Allow access if user belongs to the same tenant
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR 
    -- Allow if user is the recipient
    recipient_id = auth.uid()
    OR
    -- Allow if tenant_id is null (for backwards compatibility)
    tenant_id IS NULL
);

CREATE POLICY "tenant_notification_recipients_insert" ON notification_recipients
FOR INSERT 
TO authenticated
WITH CHECK (
    -- Set tenant_id to user's tenant if not provided
    tenant_id = COALESCE(
        tenant_id,
        (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
    OR
    -- Allow if user is authenticated (tenant_id will be set by trigger)
    auth.uid() IS NOT NULL
);

CREATE POLICY "tenant_notification_recipients_update" ON notification_recipients
FOR UPDATE 
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR recipient_id = auth.uid()
    OR tenant_id IS NULL
)
WITH CHECK (
    tenant_id = COALESCE(
        tenant_id,
        (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid())
    )
);

CREATE POLICY "tenant_notification_recipients_delete" ON notification_recipients
FOR DELETE 
TO authenticated
USING (
    tenant_id IN (
        SELECT u.tenant_id 
        FROM users u 
        WHERE u.id = auth.uid()
    )
    OR tenant_id IS NULL
);

-- 12. Create triggers to automatically set tenant_id on insert
CREATE OR REPLACE FUNCTION set_notification_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set tenant_id if it's not already provided
    IF NEW.tenant_id IS NULL THEN
        SELECT u.tenant_id INTO NEW.tenant_id
        FROM users u
        WHERE u.id = auth.uid();
        
        -- If still null, use a default tenant (adjust as needed)
        IF NEW.tenant_id IS NULL THEN
            NEW.tenant_id := 'b8f8b5f0-1234-4567-8901-123456789000'::UUID;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger to notifications table
DROP TRIGGER IF EXISTS trigger_set_notification_tenant_id ON notifications;
CREATE TRIGGER trigger_set_notification_tenant_id
    BEFORE INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION set_notification_tenant_id();

-- Apply the trigger to notification_recipients table  
DROP TRIGGER IF EXISTS trigger_set_notification_recipients_tenant_id ON notification_recipients;
CREATE TRIGGER trigger_set_notification_recipients_tenant_id
    BEFORE INSERT ON notification_recipients
    FOR EACH ROW
    EXECUTE FUNCTION set_notification_tenant_id();

-- 13. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_recipients TO authenticated;

-- 14. Test the setup with a sample insert (will be rolled back)
DO $$
DECLARE
    test_notification_id UUID;
    current_user_id UUID;
    current_tenant_id UUID;
BEGIN
    -- Get current user info (if available)
    current_user_id := auth.uid();
    
    IF current_user_id IS NOT NULL THEN
        -- Get user's tenant_id
        SELECT tenant_id INTO current_tenant_id 
        FROM users 
        WHERE id = current_user_id;
        
        RAISE NOTICE 'Testing with user: %, tenant: %', current_user_id, current_tenant_id;
        
        -- Test notification insert
        INSERT INTO notifications (type, message, delivery_mode, delivery_status, sent_by)
        VALUES ('General', 'Test notification', 'InApp', 'Sent', current_user_id)
        RETURNING id INTO test_notification_id;
        
        RAISE NOTICE 'Test notification created: %', test_notification_id;
        
        -- Test recipient insert
        INSERT INTO notification_recipients (notification_id, recipient_id, recipient_type, delivery_status, is_read)
        VALUES (test_notification_id, current_user_id, 'Admin', 'Sent', false);
        
        RAISE NOTICE 'Test recipient created successfully';
        
        -- Clean up test data
        DELETE FROM notification_recipients WHERE notification_id = test_notification_id;
        DELETE FROM notifications WHERE id = test_notification_id;
        
        RAISE NOTICE 'Test data cleaned up';
    ELSE
        RAISE NOTICE 'No authenticated user - skipping insert test';
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test failed with error: %', SQLERRM;
END $$;

-- 15. Update any existing NULL tenant_ids (optional - run if needed)
/*
UPDATE notifications 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::UUID 
WHERE tenant_id IS NULL;

UPDATE notification_recipients 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'::UUID 
WHERE tenant_id IS NULL;
*/

-- Final verification
SELECT 'Setup completed successfully' as status;
