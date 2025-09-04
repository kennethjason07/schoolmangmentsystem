-- Fix Row Level Security (RLS) policies for events table
-- Run this script in your Supabase SQL editor

-- 1. First, let's see what policies currently exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'events';

-- 2. Drop existing restrictive policies (if any)
DROP POLICY IF EXISTS "Users can view events" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

-- 3. Create more permissive policies for testing

-- Allow authenticated users to view all events
CREATE POLICY "Allow authenticated users to view events" ON public.events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert events (more permissive for testing)
CREATE POLICY "Allow authenticated users to insert events" ON public.events
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update their own events or if they're admin
CREATE POLICY "Allow authenticated users to update events" ON public.events
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role IN ('Admin', 'SuperAdmin')
            )
        )
    );

-- Allow authenticated users to delete their own events or if they're admin  
CREATE POLICY "Allow authenticated users to delete events" ON public.events
    FOR DELETE USING (
        auth.role() = 'authenticated' AND (
            created_by = auth.uid() OR
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE users.id = auth.uid() 
                AND users.role IN ('Admin', 'SuperAdmin')
            )
        )
    );

-- 4. Alternative: Temporarily disable RLS for testing (uncomment if needed)
-- ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- 5. Make sure the table has proper permissions
GRANT ALL ON public.events TO authenticated;
GRANT USAGE ON SEQUENCE events_id_seq TO authenticated;

-- 6. Also fix any tenant-related policies if tenants table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        -- Create default tenant if it doesn't exist
        INSERT INTO public.tenants (id, name, created_at, updated_at)
        VALUES (
            'default-tenant',
            'Default School',
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Grant permissions on tenants table
        GRANT ALL ON public.tenants TO authenticated;
    END IF;
END $$;

-- 7. Update your user to have admin role if needed
-- Replace 'your-admin-email@example.com' with your actual email
UPDATE public.users 
SET role = 'Admin', tenant_id = 'default-tenant'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-admin-email@example.com')
ON CONFLICT DO NOTHING;

-- 8. Also update auth metadata
UPDATE auth.users 
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    '{"tenant_id": "default-tenant", "role": "Admin"}'::jsonb
WHERE email = 'your-admin-email@example.com';

-- 9. Verify the setup
SELECT 
    'Current User' as info,
    email,
    raw_app_meta_data
FROM auth.users 
WHERE email = 'your-admin-email@example.com'
UNION ALL
SELECT 
    'Policies' as info,
    policyname,
    cmd::text
FROM pg_policies 
WHERE tablename = 'events';

-- 10. Test query to see if you can now insert
-- This should not give an error:
-- INSERT INTO public.events (title, description, event_date, event_type, is_school_wide, status, tenant_id)
-- VALUES ('Test Event', 'Test Description', CURRENT_DATE, 'Event', true, 'Active', 'default-tenant');
