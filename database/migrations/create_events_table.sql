-- Create events table for school management system
-- This script should be run in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type TEXT DEFAULT 'Event',
    is_school_wide BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON public.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for authenticated users to view events
CREATE POLICY "Users can view events" ON public.events
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for admin users to insert events
CREATE POLICY "Admins can insert events" ON public.events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('Admin', 'SuperAdmin')
        )
    );

-- Policy for admin users to update events
CREATE POLICY "Admins can update events" ON public.events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('Admin', 'SuperAdmin')
        )
    );

-- Policy for admin users to delete events
CREATE POLICY "Admins can delete events" ON public.events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('Admin', 'SuperAdmin')
        )
    );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_events_updated_at 
    BEFORE UPDATE ON public.events 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insert some sample events for testing
INSERT INTO public.events (title, description, event_date, event_type, is_school_wide, status)
VALUES 
    ('Annual Sports Day', 'School wide sports competition for all students', '2025-10-15', 'Sports', true, 'Active'),
    ('Math Quiz Competition', 'Inter-class mathematics quiz for grades 6-12', '2025-09-20', 'Academic', true, 'Active'),
    ('Parent-Teacher Meeting', 'Quarterly meeting with parents to discuss student progress', '2025-09-25', 'Meeting', true, 'Active'),
    ('Science Fair', 'Students showcase their science projects and experiments', '2025-11-05', 'Academic', true, 'Active'),
    ('Cultural Day Celebration', 'Celebration of various cultures with performances and food', '2025-12-10', 'Cultural', true, 'Active')
ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON public.events TO authenticated;
GRANT USAGE ON SEQUENCE events_id_seq TO authenticated;

COMMENT ON TABLE public.events IS 'Table to store school events, announcements, and important dates';
COMMENT ON COLUMN public.events.event_date IS 'Date when the event is scheduled to occur';
COMMENT ON COLUMN public.events.is_school_wide IS 'Whether the event is visible to entire school or specific classes only';
COMMENT ON COLUMN public.events.status IS 'Status of the event: Active, Cancelled, Completed, etc.';
