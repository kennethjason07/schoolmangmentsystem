-- Fix school_details table issues
-- Run this SQL in your Supabase SQL editor

-- First, let's clean up any existing data
DELETE FROM public.school_details;

-- Drop and recreate the table to ensure clean state
DROP TABLE IF EXISTS public.school_details;

-- Create school_details table
CREATE TABLE public.school_details (
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

-- Disable RLS to avoid permission issues
ALTER TABLE public.school_details DISABLE ROW LEVEL SECURITY;

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_school_details_updated_at ON public.school_details;
CREATE TRIGGER update_school_details_updated_at
    BEFORE UPDATE ON public.school_details
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify table is empty
SELECT COUNT(*) as record_count FROM public.school_details;
