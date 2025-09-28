-- Row Level Security Policies for Facial Recognition Tables
-- Run this in your Supabase SQL Editor

-- First, drop any existing policies that might be conflicting
DROP POLICY IF EXISTS "Users can access facial templates for their tenant" ON facial_templates;
DROP POLICY IF EXISTS "Users can insert facial templates for their tenant" ON facial_templates;
DROP POLICY IF EXISTS "Users can access facial recognition events for their tenant" ON facial_recognition_events;
DROP POLICY IF EXISTS "Users can insert facial recognition events for their tenant" ON facial_recognition_events;

-- Enable RLS on facial_templates table (if not already enabled)
ALTER TABLE facial_templates ENABLE ROW LEVEL SECURITY;

-- Enable RLS on facial_recognition_events table (if not already enabled) 
ALTER TABLE facial_recognition_events ENABLE ROW LEVEL SECURITY;

-- Simple policy for facial_templates - Allow all operations for authenticated users
-- This matches the pattern of other tables in your schema
CREATE POLICY "Enable all operations for authenticated users" ON facial_templates
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Simple policy for facial_recognition_events - Allow all operations for authenticated users
CREATE POLICY "Enable all operations for authenticated users" ON facial_recognition_events
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL ON facial_templates TO authenticated;
GRANT ALL ON facial_recognition_events TO authenticated;

-- Alternative: If you need tenant isolation, use these policies instead:
-- (Comment out the simple policies above and uncomment these)

/*
-- Tenant-aware policy for facial_templates
CREATE POLICY "Tenant isolation for facial templates" ON facial_templates
FOR ALL TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);

-- Tenant-aware policy for facial_recognition_events  
CREATE POLICY "Tenant isolation for facial recognition events" ON facial_recognition_events
FOR ALL TO authenticated
USING (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  )
);
*/
