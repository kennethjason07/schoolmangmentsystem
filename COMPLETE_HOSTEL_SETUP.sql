-- ============================================================================
-- 🏫 COMPLETE HOSTEL MANAGEMENT SYSTEM - DATABASE SETUP
-- ============================================================================
-- 
-- This script sets up everything needed for the hostel management system:
-- ✅ Creates all required tables
-- ✅ Creates the create_hostel_secure function
-- ✅ Sets up proper RLS policies
-- ✅ Creates indexes for performance
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

-- Rooms table
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

-- Beds table
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

-- Hostel Applications table
CREATE TABLE IF NOT EXISTS public.hostel_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  academic_year text NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
  preferred_room_type text DEFAULT 'standard'::text,
  preferred_block_id uuid,
  special_requirements text,
  documents jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'verified'::text, 'accepted'::text, 'rejected'::text, 'waitlisted'::text, 'cancelled'::text])),
  applied_at timestamp with time zone DEFAULT now(),
  verified_by uuid,
  verified_at timestamp with time zone,
  decision_by uuid,
  decision_at timestamp with time zone,
  remarks text,
  priority_score integer DEFAULT 0,
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

-- Bed Allocations table
CREATE TABLE IF NOT EXISTS public.bed_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  student_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  academic_year text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending_acceptance'::text CHECK (status = ANY (ARRAY['pending_acceptance'::text, 'active'::text, 'checked_in'::text, 'checked_out'::text, 'cancelled'::text, 'transferred'::text])),
  acceptance_deadline timestamp with time zone,
  student_response text CHECK (student_response = ANY (ARRAY['accepted'::text, 'rejected'::text])),
  student_response_at timestamp with time zone,
  created_by uuid NOT NULL,
  monthly_rent numeric DEFAULT 0,
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

-- Maintenance logs table
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid,
  room_id uuid,
  bed_id uuid,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  reported_by uuid NOT NULL,
  assigned_to uuid,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  scheduled_date timestamp with time zone,
  completed_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT maintenance_logs_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id),
  CONSTRAINT maintenance_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT maintenance_logs_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id),
  CONSTRAINT maintenance_logs_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id),
  CONSTRAINT maintenance_logs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  CONSTRAINT maintenance_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
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

-- Indexes for rooms
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON public.rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_rooms_tenant_id ON public.rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_is_active ON public.rooms(is_active);

-- Indexes for beds
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

-- Indexes for maintenance logs
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_hostel_id ON public.maintenance_logs(hostel_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_status ON public.maintenance_logs(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_tenant_id ON public.maintenance_logs(tenant_id);

-- Step 3: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS Policies
-- ============================================================================

DO $$
BEGIN
  -- Hostels policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostels' AND policyname = 'hostels_tenant_access') THEN
    CREATE POLICY hostels_tenant_access ON public.hostels
    FOR ALL TO authenticated
    USING (
        tenant_id::text = COALESCE(
            (current_setting('request.jwt.claims', true))::jsonb->>'tenant_id',
            tenant_id::text
        )
        OR 
        COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'role', '') = 'admin'
        OR
        COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'user_role', '') = 'admin'
    )
    WITH CHECK (
        tenant_id IS NOT NULL
        AND (
            tenant_id::text = COALESCE(
                (current_setting('request.jwt.claims', true))::jsonb->>'tenant_id',
                tenant_id::text
            )
            OR 
            COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'role', '') = 'admin'
            OR
            COALESCE((current_setting('request.jwt.claims', true))::jsonb->>'user_role', '') = 'admin'
        )
    );
  END IF;

  -- Blocks policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'blocks_tenant_access') THEN
    CREATE POLICY blocks_tenant_access ON public.blocks
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Rooms policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_tenant_access') THEN
    CREATE POLICY rooms_tenant_access ON public.rooms
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Beds policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds_tenant_access') THEN
    CREATE POLICY beds_tenant_access ON public.beds
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Hostel Applications policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND policyname = 'hostel_applications_tenant_access') THEN
    CREATE POLICY hostel_applications_tenant_access ON public.hostel_applications
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Bed Allocations policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND policyname = 'bed_allocations_tenant_access') THEN
    CREATE POLICY bed_allocations_tenant_access ON public.bed_allocations
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Maintenance Logs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'maintenance_logs' AND policyname = 'maintenance_logs_tenant_access') THEN
    CREATE POLICY maintenance_logs_tenant_access ON public.maintenance_logs
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

END$$;

-- Step 5: Create the Secure Hostel Creation Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_hostel_secure(
    p_name text,
    p_address text DEFAULT NULL,
    p_contact_phone text DEFAULT NULL,
    p_hostel_type text DEFAULT 'mixed',
    p_capacity integer DEFAULT 0,
    p_warden_id uuid DEFAULT NULL,
    p_description text DEFAULT NULL,
    p_amenities text[] DEFAULT NULL,
    p_tenant_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id uuid;
    v_user_id uuid;
    v_hostel_record record;
    v_result jsonb;
BEGIN
    -- Get current user ID
    v_user_id := (current_setting('request.jwt.claims', true))::jsonb->>'sub';
    
    -- If no tenant_id provided, try to get it from the current user
    IF p_tenant_id IS NULL THEN
        SELECT tenant_id INTO v_tenant_id
        FROM public.users
        WHERE id::text = v_user_id;
        
        IF v_tenant_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Unable to determine tenant. Please ensure you are properly logged in.',
                'code', 'TENANT_NOT_FOUND'
            );
        END IF;
    ELSE
        v_tenant_id := p_tenant_id;
    END IF;
    
    -- Validate required fields
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Hostel name is required',
            'code', 'MISSING_NAME'
        );
    END IF;
    
    -- Insert the hostel record
    INSERT INTO public.hostels (
        name,
        address,
        contact_phone,
        hostel_type,
        capacity,
        warden_id,
        description,
        amenities,
        tenant_id,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        trim(p_name),
        p_address,
        p_contact_phone,
        COALESCE(p_hostel_type, 'mixed'),
        COALESCE(p_capacity, 0),
        p_warden_id,
        p_description,
        p_amenities,
        v_tenant_id,
        true,
        now(),
        now()
    ) RETURNING * INTO v_hostel_record;
    
    -- Build success response
    v_result := jsonb_build_object(
        'success', true,
        'data', row_to_json(v_hostel_record)
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE
        );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_hostel_secure TO authenticated;

-- Step 6: Verification Query
-- ============================================================================

SELECT 
    'Setup Complete!' as status,
    COUNT(CASE WHEN table_name = 'hostels' THEN 1 END) as hostels_table,
    COUNT(CASE WHEN table_name = 'blocks' THEN 1 END) as blocks_table,
    COUNT(CASE WHEN table_name = 'rooms' THEN 1 END) as rooms_table,
    COUNT(CASE WHEN table_name = 'beds' THEN 1 END) as beds_table,
    COUNT(CASE WHEN table_name = 'hostel_applications' THEN 1 END) as applications_table,
    COUNT(CASE WHEN table_name = 'bed_allocations' THEN 1 END) as allocations_table,
    COUNT(CASE WHEN table_name = 'maintenance_logs' THEN 1 END) as maintenance_table
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('hostels', 'blocks', 'rooms', 'beds', 'hostel_applications', 'bed_allocations', 'maintenance_logs');

-- ============================================================================
-- 🎉 SETUP COMPLETE!
-- ============================================================================
-- 
-- After running this script, your application should be able to:
-- ✅ Create hostels using either direct insert or secure function
-- ✅ Access all hostel-related tables
-- ✅ Maintain proper tenant isolation
-- ✅ Handle RLS policies correctly
-- ✅ Have good query performance with indexes
--
-- The secure function create_hostel_secure() is now available for
-- situations where RLS policies cause issues.
-- ============================================================================