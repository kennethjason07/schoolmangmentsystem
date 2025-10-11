-- ============================================================================
-- 🏫 HOSTEL MANAGEMENT SYSTEM - DATABASE TABLES SETUP
-- ============================================================================
-- 
-- PROBLEM: Your application is getting "relation 'public.rooms' does not exist" 
-- CAUSE: Based on schema.txt analysis, hostel tables are missing from your database
-- SOLUTION: Execute this script in Supabase SQL Editor
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to SQL Editor in the sidebar
-- 3. Create a new query
-- 4. Copy and paste this ENTIRE script
-- 5. Click "Run" to execute
-- ============================================================================

-- Step 1: Create Hostel Tables
-- ============================================================================

-- Hostels table - Main hostel information
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  contact_phone text,
  hostel_type text DEFAULT 'mixed'::text CHECK (hostel_type = ANY (ARRAY['boys'::text, 'girls'::text, 'mixed'::text])),
  capacity integer DEFAULT 0,
  warden_id uuid, -- Reference to users table
  description text,
  amenities text[], -- Array of amenities like WiFi, Mess, etc.
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostels_pkey PRIMARY KEY (id),
  CONSTRAINT hostels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT hostels_warden_id_fkey FOREIGN KEY (warden_id) REFERENCES public.users(id)
);

-- Blocks table - Sections within hostels (like Block A, Block B)
CREATE TABLE IF NOT EXISTS public.blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  total_floors integer DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT blocks_pkey PRIMARY KEY (id),
  CONSTRAINT blocks_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- 🎯 ROOMS TABLE - THIS IS WHAT YOUR APP IS LOOKING FOR!
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid NOT NULL,
  block_id uuid,
  floor integer DEFAULT 1,
  room_number text NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  room_type text DEFAULT 'standard'::text CHECK (room_type = ANY (ARRAY['standard'::text, 'deluxe'::text, 'premium'::text, 'accessible'::text])),
  amenities text[], -- Array of room amenities
  monthly_fee numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT rooms_pkey PRIMARY KEY (id),
  CONSTRAINT rooms_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT rooms_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id),
  CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT rooms_unique_number_per_hostel UNIQUE (hostel_id, room_number)
);

-- 🎯 BEDS TABLE - THIS IS WHAT YOUR APP IS LOOKING FOR!
CREATE TABLE IF NOT EXISTS public.beds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  bed_label text, -- A, B, 1, 2, etc.
  bed_type text DEFAULT 'normal'::text CHECK (bed_type = ANY (ARRAY['normal'::text, 'lower'::text, 'upper'::text, 'accessible'::text])),
  status text NOT NULL DEFAULT 'available'::text CHECK (status = ANY (ARRAY['available'::text, 'occupied'::text, 'maintenance'::text, 'reserved'::text])),
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT beds_pkey PRIMARY KEY (id),
  CONSTRAINT beds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
  CONSTRAINT beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT beds_unique_label_per_room UNIQUE (room_id, bed_label)
);

-- Hostel Applications table - Student applications for hostel accommodation
CREATE TABLE IF NOT EXISTS public.hostel_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  academic_year text NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
  preferred_room_type text DEFAULT 'standard'::text,
  preferred_block_id uuid,
  special_requirements text,
  documents jsonb DEFAULT '[]'::jsonb, -- Array of document objects
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'verified'::text, 'accepted'::text, 'rejected'::text, 'waitlisted'::text, 'cancelled'::text])),
  applied_at timestamp with time zone DEFAULT now(),
  verified_by uuid,
  verified_at timestamp with time zone,
  decision_by uuid, -- Admin/Warden who made acceptance decision
  decision_at timestamp with time zone,
  remarks text,
  priority_score integer DEFAULT 0, -- For automatic allocation algorithms
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_applications_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT hostel_applications_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id),
  CONSTRAINT hostel_applications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id),
  CONSTRAINT hostel_applications_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id),
  CONSTRAINT hostel_applications_preferred_block_id_fkey FOREIGN KEY (preferred_block_id) REFERENCES public.blocks(id),
  CONSTRAINT hostel_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT hostel_applications_unique_student_year_hostel UNIQUE (student_id, academic_year, hostel_id)
);

-- Bed Allocations table - Current and historical bed allocations to students
CREATE TABLE IF NOT EXISTS public.bed_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  student_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  academic_year text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending_acceptance'::text CHECK (status = ANY (ARRAY['pending_acceptance'::text, 'active'::text, 'checked_in'::text, 'checked_out'::text, 'cancelled'::text, 'transferred'::text])),
  acceptance_deadline timestamp with time zone, -- When student must respond
  student_response text CHECK (student_response = ANY (ARRAY['accepted'::text, 'rejected'::text])),
  student_response_at timestamp with time zone,
  created_by uuid NOT NULL, -- Admin/Warden who created allocation
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT bed_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT bed_allocations_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id),
  CONSTRAINT bed_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id),
  CONSTRAINT bed_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id),
  CONSTRAINT bed_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Step 2: Create Performance Indexes
-- ============================================================================

-- Indexes for hostels
CREATE INDEX IF NOT EXISTS idx_hostels_tenant_id ON public.hostels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostels_warden_id ON public.hostels(warden_id);
CREATE INDEX IF NOT EXISTS idx_hostels_is_active ON public.hostels(is_active);

-- Indexes for blocks
CREATE INDEX IF NOT EXISTS idx_blocks_hostel_id ON public.blocks(hostel_id);
CREATE INDEX IF NOT EXISTS idx_blocks_tenant_id ON public.blocks(tenant_id);

-- Indexes for rooms (CRITICAL for your app performance!)
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON public.rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON public.rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);

-- Indexes for beds (CRITICAL for your app performance!)
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);
CREATE INDEX IF NOT EXISTS idx_beds_tenant_id ON public.beds(tenant_id);

-- Indexes for hostel applications
CREATE INDEX IF NOT EXISTS idx_hostel_applications_student_id ON public.hostel_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_status ON public.hostel_applications(status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_hostel_id ON public.hostel_applications(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_tenant_id ON public.hostel_applications(tenant_id);

-- Indexes for bed allocations
CREATE INDEX IF NOT EXISTS idx_bed_allocations_bed_id ON public.bed_allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_student_id ON public.bed_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_status ON public.bed_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_tenant_id ON public.bed_allocations(tenant_id);

-- Step 3: Enable Row Level Security (RLS) for Multi-Tenant Isolation
-- ============================================================================

-- Enable RLS on all hostel tables (matching your existing schema pattern)
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies for Tenant Isolation
-- ============================================================================

-- Create RLS policies for tenant isolation (matching your existing pattern)
DO $$
BEGIN
  -- Hostels policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostels' AND policyname = 'hostels_tenant_isolation') THEN
    CREATE POLICY hostels_tenant_isolation ON public.hostels
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Blocks policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'blocks_tenant_isolation') THEN
    CREATE POLICY blocks_tenant_isolation ON public.blocks
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Rooms policies (CRITICAL!)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_tenant_isolation') THEN
    CREATE POLICY rooms_tenant_isolation ON public.rooms
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Beds policies (CRITICAL!)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds_tenant_isolation') THEN
    CREATE POLICY beds_tenant_isolation ON public.beds
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Hostel Applications policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND policyname = 'hostel_applications_tenant_isolation') THEN
    CREATE POLICY hostel_applications_tenant_isolation ON public.hostel_applications
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Bed Allocations policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND policyname = 'bed_allocations_tenant_isolation') THEN
    CREATE POLICY bed_allocations_tenant_isolation ON public.bed_allocations
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

END$$;

-- Step 5: Create Sample Data (Optional)
-- ============================================================================
-- Uncomment the section below if you want to create some sample data for testing

/*
-- Get the first tenant ID for sample data
DO $$
DECLARE
    sample_tenant_id uuid;
BEGIN
    -- Get first tenant ID
    SELECT id INTO sample_tenant_id FROM public.tenants LIMIT 1;
    
    IF sample_tenant_id IS NOT NULL THEN
        -- Insert a sample hostel
        INSERT INTO public.hostels (tenant_id, name, description, hostel_type, capacity, is_active, amenities)
        VALUES (
            sample_tenant_id,
            'Main Hostel Block',
            'Primary hostel building for students',
            'mixed',
            100,
            true,
            ARRAY['WiFi', 'Mess', 'Recreation Room', 'Study Hall', 'Laundry']
        )
        ON CONFLICT DO NOTHING;
        
        -- Insert sample blocks and rooms would go here...
        -- (You can add more sample data as needed)
        
        RAISE NOTICE 'Sample hostel data created for tenant: %', sample_tenant_id;
    END IF;
END$$;
*/

-- Step 6: Verification Query
-- ============================================================================

-- Check if tables were created successfully
SELECT 
    'Tables Created Successfully!' as status,
    COUNT(CASE WHEN table_name = 'hostels' THEN 1 END) as hostels_table,
    COUNT(CASE WHEN table_name = 'blocks' THEN 1 END) as blocks_table,
    COUNT(CASE WHEN table_name = 'rooms' THEN 1 END) as rooms_table,
    COUNT(CASE WHEN table_name = 'beds' THEN 1 END) as beds_table,
    COUNT(CASE WHEN table_name = 'hostel_applications' THEN 1 END) as applications_table,
    COUNT(CASE WHEN table_name = 'bed_allocations' THEN 1 END) as allocations_table
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('hostels', 'blocks', 'rooms', 'beds', 'hostel_applications', 'bed_allocations');

-- ============================================================================
-- 🎉 SETUP COMPLETE!
-- ============================================================================
-- 
-- After running this script, your application should be able to:
-- ✅ Access public.rooms table (fixing the "relation does not exist" error)
-- ✅ Access public.beds table (fixing the "relation does not exist" error)  
-- ✅ Use all hostel management features
-- ✅ Maintain proper tenant isolation
-- ✅ Have good query performance with indexes
--
-- If you still get errors after this, they are likely related to:
-- - Authentication/session issues
-- - Tenant ID not being set correctly in JWT claims  
-- - Application code trying to access tables without being authenticated
--
-- ============================================================================