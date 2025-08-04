-- Create school_details table for storing school/college information
-- Run this SQL in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.school_details (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'School',
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  website text,
  principal_name text,
  established_year text,
  affiliation text,
  logo_url text,
  description text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT school_details_pkey PRIMARY KEY (id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.school_details ENABLE ROW LEVEL SECURITY;

-- Create policies for school_details table
-- Allow all authenticated users to read school details
CREATE POLICY "Allow authenticated users to read school details" ON public.school_details
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert/update school details (simplified for now)
CREATE POLICY "Allow authenticated users to modify school details" ON public.school_details
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_school_details_updated_at
    BEFORE UPDATE ON public.school_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a default school record (optional)
INSERT INTO public.school_details (
  name,
  type,
  description
) VALUES (
  'School Management System',
  'School',
  'Welcome to our educational institution management system'
) ON CONFLICT DO NOTHING;
