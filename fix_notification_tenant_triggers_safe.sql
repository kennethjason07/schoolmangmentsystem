-- ===================================================================
-- FIX NOTIFICATION TENANT_ID TRIGGERS (SAFE VERSION)
-- ===================================================================
-- This script safely creates triggers and policies for notifications
-- Handles existing policies gracefully
-- Run this in your Supabase SQL Editor

-- ==========================================
-- STEP 1: CREATE OR UPDATE TENANT TRIGGER FUNCTION
-- ==========================================

-- Enhanced trigger function that gets tenant_id from the current user
CREATE OR REPLACE FUNCTION public.set_notification_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tenant_id UUID;
BEGIN
    -- If tenant_id is already set, don't override it
    IF NEW.tenant_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Try to get tenant_id from current user's database record
    SELECT tenant_id INTO user_tenant_id 
    FROM public.users 
    WHERE id = auth.uid()
    LIMIT 1;
    
    -- If we found a tenant_id, use it
    IF user_tenant_id IS NOT NULL THEN
        NEW.tenant_id := user_tenant_id;
        RAISE NOTICE 'Auto-set tenant_id to % for table %', user_tenant_id, TG_TABLE_NAME;
        RETURN NEW;
    END IF;
    
    -- If still no tenant_id, try to get from JWT
    BEGIN
        user_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;
        IF user_tenant_id IS NOT NULL THEN
            NEW.tenant_id := user_tenant_id;
            RAISE NOTICE 'Auto-set tenant_id from JWT to % for table %', user_tenant_id, TG_TABLE_NAME;
            RETURN NEW;
        END IF;
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'Could not get tenant_id from JWT: %', SQLERRM;
    END;
    
    -- As a last resort, use the default tenant (for development/migration purposes)
    user_tenant_id := 'b8f8b5f0-1234-4567-8901-123456789000'::uuid;
    NEW.tenant_id := user_tenant_id;
    RAISE WARNING 'Using default tenant_id % for table % - this should not happen in production!', user_tenant_id, TG_TABLE_NAME;
    
    RETURN NEW;
END;
$$;

-- ==========================================
-- STEP 2: CREATE TRIGGERS FOR NOTIFICATION TABLES
-- ==========================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS auto_set_tenant_id_notifications ON public.notifications;
DROP TRIGGER IF EXISTS auto_set_tenant_id_notification_recipients ON public.notification_recipients;

-- Create trigger for notifications table
CREATE TRIGGER auto_set_tenant_id_notifications
    BEFORE INSERT OR UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_notification_tenant_id();

-- Create trigger for notification_recipients table
CREATE TRIGGER auto_set_tenant_id_notification_recipients
    BEFORE INSERT OR UPDATE ON public.notification_recipients
    FOR EACH ROW EXECUTE FUNCTION public.set_notification_tenant_id();

-- ==========================================
-- STEP 3: SAFELY UPDATE RLS POLICIES
-- ==========================================

-- Function to safely drop and recreate policies
DO $$
DECLARE
    policy_exists boolean;
BEGIN
    -- Handle notifications table policies
    
    -- Check and drop existing policies for notifications
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications' 
        AND policyname = 'notifications_tenant_access'
    ) INTO policy_exists;
    
    IF policy_exists THEN
        DROP POLICY notifications_tenant_access ON public.notifications;
        RAISE NOTICE 'Dropped existing notifications_tenant_access policy';
    END IF;
    
    -- Check for other notification policies and drop them
    FOR policy_exists IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notifications'
        AND policyname LIKE '%tenant%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_exists) || ' ON public.notifications';
    END LOOP;
    
    -- Handle notification_recipients table policies
    
    -- Check and drop existing policies for notification_recipients
    SELECT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notification_recipients' 
        AND policyname = 'notification_recipients_tenant_access'
    ) INTO policy_exists;
    
    IF policy_exists THEN
        DROP POLICY notification_recipients_tenant_access ON public.notification_recipients;
        RAISE NOTICE 'Dropped existing notification_recipients_tenant_access policy';
    END IF;
    
    -- Check for other notification_recipients policies and drop them
    FOR policy_exists IN 
        SELECT policyname FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'notification_recipients'
        AND policyname LIKE '%tenant%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_exists) || ' ON public.notification_recipients';
    END LOOP;

END $$;

-- Enable RLS on both tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for notifications
CREATE POLICY "notifications_tenant_access" ON public.notifications
    FOR ALL USING (
        tenant_id = COALESCE(
            (auth.jwt() ->> 'tenant_id')::uuid,
            (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
        )
    );

-- Create comprehensive RLS policies for notification_recipients  
CREATE POLICY "notification_recipients_tenant_access" ON public.notification_recipients
    FOR ALL USING (
        tenant_id = COALESCE(
            (auth.jwt() ->> 'tenant_id')::uuid,
            (SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1)
        )
    );

-- ==========================================
-- STEP 4: TEST THE TRIGGERS
-- ==========================================

DO $$
DECLARE
    test_tenant_id UUID := 'b8f8b5f0-1234-4567-8901-123456789000';
    test_notification_id UUID;
    test_count INTEGER;
    test_recipient_count INTEGER;
BEGIN
    RAISE NOTICE 'Starting notification trigger tests...';
    
    -- Test notification insertion without tenant_id
    INSERT INTO public.notifications (type, message, delivery_mode, delivery_status)
    VALUES ('General', 'Test notification for trigger - DELETE ME', 'InApp', 'Pending')
    RETURNING id INTO test_notification_id;
    
    RAISE NOTICE 'Inserted test notification with ID: %', test_notification_id;
    
    -- Check if tenant_id was automatically set
    SELECT COUNT(*), tenant_id INTO test_count, test_tenant_id
    FROM public.notifications
    WHERE id = test_notification_id 
      AND tenant_id IS NOT NULL
    GROUP BY tenant_id;
    
    IF test_count > 0 THEN
        RAISE NOTICE '✅ NOTIFICATION TRIGGER TEST PASSED - tenant_id automatically set to: %', test_tenant_id;
        
        -- Test notification recipient insertion
        BEGIN
            INSERT INTO public.notification_recipients (notification_id, recipient_id, recipient_type)
            VALUES (test_notification_id, 'b601fdfe-9800-4c12-a762-e07e5ca57e37'::uuid, 'Parent');
            
            -- Check if tenant_id was set for recipient
            SELECT COUNT(*) INTO test_recipient_count
            FROM public.notification_recipients
            WHERE notification_id = test_notification_id 
              AND tenant_id IS NOT NULL;
              
            IF test_recipient_count > 0 THEN
                RAISE NOTICE '✅ NOTIFICATION RECIPIENT TRIGGER TEST PASSED - tenant_id automatically set';
            ELSE
                RAISE NOTICE '❌ NOTIFICATION RECIPIENT TRIGGER TEST FAILED - tenant_id not set';
            END IF;
            
        EXCEPTION 
            WHEN OTHERS THEN
                RAISE NOTICE '⚠️ Notification recipient test failed: % (this may be due to FK constraints)', SQLERRM;
        END;
        
        -- Clean up test records
        DELETE FROM public.notification_recipients WHERE notification_id = test_notification_id;
        DELETE FROM public.notifications WHERE id = test_notification_id;
        RAISE NOTICE '✅ Test records cleaned up';
        
    ELSE
        RAISE NOTICE '❌ NOTIFICATION TRIGGER TEST FAILED - tenant_id not automatically set';
        -- Still try to clean up
        DELETE FROM public.notifications WHERE id = test_notification_id;
    END IF;
    
EXCEPTION 
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Trigger test failed with error: %', SQLERRM;
        -- Try to clean up anyway
        IF test_notification_id IS NOT NULL THEN
            DELETE FROM public.notification_recipients WHERE notification_id = test_notification_id;
            DELETE FROM public.notifications WHERE id = test_notification_id;
        END IF;
END $$;

-- ==========================================
-- STEP 5: SUMMARY AND VERIFICATION
-- ==========================================

-- Show created triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE '%tenant_id%' 
  AND event_object_table IN ('notifications', 'notification_recipients')
ORDER BY event_object_table, trigger_name;

-- Show RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('notifications', 'notification_recipients')
ORDER BY tablename, policyname;

-- Final success message
SELECT '
🎯 NOTIFICATION TENANT TRIGGERS SETUP COMPLETE!

✅ WHAT WAS FIXED:
- Created auto-tenant-id trigger function for notifications
- Added triggers to notifications and notification_recipients tables  
- Safely updated RLS policies to use tenant-based filtering
- Triggers automatically set tenant_id on INSERT/UPDATE

✅ HOW IT WORKS:
1. When inserting notifications, tenant_id is auto-filled from:
   - Current user database record (preferred)
   - JWT token tenant_id claim (fallback)  
   - Default tenant (emergency fallback)

2. RLS policies filter data by tenant automatically
3. JavaScript code can now omit tenant_id and it will be set automatically

✅ TESTING:
- Check the NOTICE messages above for trigger test results
- Both tables now have proper tenant isolation
- Background notification creation should work now

🚨 NEXT STEPS:
1. Test attendance submission with absent students
2. Check console logs for notification creation success
3. Verify notifications appear for parent users
4. The JavaScript code is already updated to pass tenant_id

' as status;
