-- Create events table for school events
CREATE TABLE IF NOT EXISTS public.events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    event_type TEXT DEFAULT 'Event', -- 'Event', 'Meeting', 'Holiday', etc.
    location TEXT,
    organizer TEXT,
    is_school_wide BOOLEAN DEFAULT true,
    target_classes uuid[], -- Array of class IDs if not school-wide
    target_students uuid[], -- Array of student IDs for specific events
    status TEXT DEFAULT 'Active', -- 'Active', 'Cancelled', 'Completed'
    icon TEXT DEFAULT 'calendar',
    color TEXT DEFAULT '#FF9800',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES public.users(id),
    CONSTRAINT events_pkey PRIMARY KEY (id)
);

-- Create indexes for better performance
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_type ON public.events(event_type);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_created_by ON public.events(created_by);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION update_events_updated_at();
