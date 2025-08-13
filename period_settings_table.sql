-- Create period_settings table for configurable period timings
-- This table stores the time slots for the school's period structure
-- Simplified for single-school system (no school_id needed)

CREATE TABLE public.period_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    period_number integer NOT NULL CHECK (period_number > 0),
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_time - start_time)) / 60
    ) STORED,
    period_name text, -- Optional: "Period 1", "Morning Break", "Lunch", etc.
    period_type text DEFAULT 'class' CHECK (period_type = ANY (ARRAY['class'::text, 'break'::text, 'lunch'::text])),
    is_active boolean DEFAULT true,
    academic_year text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT period_settings_pkey PRIMARY KEY (id),
    CONSTRAINT period_settings_unique_period UNIQUE (period_number, academic_year),
    CONSTRAINT period_settings_time_order CHECK (start_time < end_time)
);

-- Create indexes for better performance
CREATE INDEX idx_period_settings_academic_year ON period_settings(academic_year);
CREATE INDEX idx_period_settings_period_num ON period_settings(period_number);
CREATE INDEX idx_period_settings_active ON period_settings(is_active);
CREATE INDEX idx_period_settings_time ON period_settings(start_time, end_time);

-- Insert default period structure (typical 8-period school day)
INSERT INTO period_settings (
    period_number, start_time, end_time, period_name, period_type, academic_year
) VALUES 
    (1, '08:00', '08:45', 'Period 1', 'class', '2024-25'),
    (2, '08:45', '09:30', 'Period 2', 'class', '2024-25'),
    (3, '09:45', '10:30', 'Period 3', 'class', '2024-25'),
    (4, '10:30', '11:15', 'Period 4', 'class', '2024-25'),
    (5, '11:30', '12:15', 'Period 5', 'class', '2024-25'),
    (6, '12:15', '13:00', 'Period 6', 'class', '2024-25'),
    (7, '14:00', '14:45', 'Period 7', 'class', '2024-25'),
    (8, '14:45', '15:30', 'Period 8', 'class', '2024-25');

-- Optional: Add break periods (commented out for now, can be enabled later)
-- INSERT INTO period_settings (
--     period_number, start_time, end_time, period_name, period_type, academic_year
-- ) VALUES 
--     (9, '09:30', '09:45', 'Morning Break', 'break', '2024-25'),
--     (10, '11:15', '11:30', 'Short Break', 'break', '2024-25'),
--     (11, '13:00', '14:00', 'Lunch Break', 'lunch', '2024-25');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_period_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_period_settings_updated_at 
    BEFORE UPDATE ON period_settings 
    FOR EACH ROW EXECUTE FUNCTION update_period_settings_updated_at();

-- Example query to get active class periods ordered by time
SELECT 
    period_number,
    start_time,
    end_time,
    duration_minutes,
    period_name,
    period_type
FROM period_settings 
WHERE is_active = true 
    AND period_type = 'class'
    AND academic_year = '2024-25'
ORDER BY start_time;

-- ..