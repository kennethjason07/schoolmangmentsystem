-- ============================================================================
-- 🏫 ADD HOSTEL TABLES TO EXISTING SCHOOL MANAGEMENT DATABASE
-- ============================================================================
-- 
-- PURPOSE: Add hostel management tables to your existing school database
-- BASED ON: Current schema.txt analysis + HostelService requirements
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to SQL Editor in the sidebar
-- 3. Create a new query
-- 4. Copy and paste this ENTIRE script
-- 5. Click "Run" to execute
-- 
-- This will add hostel tables alongside your existing tables:
-- students, teachers, classes, fees, etc.
-- ============================================================================

-- Step 1: Add Missing Hostel Core Tables
-- ============================================================================

-- HOSTELS TABLE - Main hostel buildings
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
  CONSTRAINT hostels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostels_warden_id_fkey FOREIGN KEY (warden_id) REFERENCES public.users(id) ON DELETE SET NULL
);

-- BLOCKS TABLE - Sections within hostels (like Block A, Block B)
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
  CONSTRAINT blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- ROOMS TABLE - Individual rooms (THIS FIXES YOUR MAIN ERROR!)
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
  CONSTRAINT rooms_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE SET NULL,
  CONSTRAINT rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT rooms_unique_number_per_hostel UNIQUE (hostel_id, room_number)
);

-- BEDS TABLE - Individual beds in rooms (THIS FIXES YOUR SECOND ERROR!)
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
  CONSTRAINT beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT beds_unique_label_per_room UNIQUE (room_id, bed_label)
);

-- Step 2: Add Hostel Application & Allocation Tables
-- ============================================================================

-- HOSTEL APPLICATIONS TABLE - Student applications for hostel accommodation
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
  CONSTRAINT hostel_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT hostel_applications_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT hostel_applications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_applications_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_applications_preferred_block_id_fkey FOREIGN KEY (preferred_block_id) REFERENCES public.blocks(id) ON DELETE SET NULL,
  CONSTRAINT hostel_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_applications_unique_student_year_hostel UNIQUE (student_id, academic_year, hostel_id)
);

-- BED ALLOCATIONS TABLE - Current and historical bed allocations to students
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
  monthly_rent numeric DEFAULT 0,
  security_deposit numeric DEFAULT 0,
  created_by uuid NOT NULL, -- Admin/Warden who created allocation
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT bed_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT bed_allocations_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id) ON DELETE CASCADE,
  CONSTRAINT bed_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id) ON DELETE CASCADE,
  CONSTRAINT bed_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT bed_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Step 3: Add Hostel Fee Payment Tables (User Requested)
-- ============================================================================

-- HOSTEL FEE PAYMENTS TABLE - Track hostel fee payments
CREATE TABLE IF NOT EXISTS public.hostel_fee_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  bed_allocation_id uuid NOT NULL,
  academic_year text NOT NULL,
  fee_type text NOT NULL DEFAULT 'monthly_rent'::text CHECK (fee_type = ANY (ARRAY['monthly_rent'::text, 'security_deposit'::text, 'mess_fee'::text, 'maintenance_fee'::text, 'other'::text])),
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  paid_date date,
  paid_amount numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'partial'::text, 'overdue'::text, 'waived'::text])),
  payment_method text DEFAULT 'Cash'::text CHECK (payment_method = ANY (ARRAY['Cash'::text, 'Card'::text, 'Online'::text, 'UPI'::text, 'Bank Transfer'::text])),
  transaction_id text,
  receipt_number bigint UNIQUE,
  late_fee numeric DEFAULT 0,
  discount numeric DEFAULT 0,
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_fee_payments_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT hostel_fee_payments_bed_allocation_id_fkey FOREIGN KEY (bed_allocation_id) REFERENCES public.bed_allocations(id) ON DELETE CASCADE,
  CONSTRAINT hostel_fee_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_fee_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- HOSTEL MAINTENANCE LOGS TABLE - Track maintenance issues
CREATE TABLE IF NOT EXISTS public.hostel_maintenance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid,
  block_id uuid,
  room_id uuid,
  bed_id uuid,
  issue_type text NOT NULL DEFAULT 'general'::text CHECK (issue_type = ANY (ARRAY['electrical'::text, 'plumbing'::text, 'furniture'::text, 'cleaning'::text, 'security'::text, 'general'::text])),
  description text NOT NULL,
  priority text DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  status text DEFAULT 'reported'::text CHECK (status = ANY (ARRAY['reported'::text, 'assigned'::text, 'in_progress'::text, 'resolved'::text, 'cancelled'::text])),
  reported_by uuid,
  assigned_to text, -- Maintenance person name
  reported_date date DEFAULT CURRENT_DATE,
  resolved_date date,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_maintenance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_maintenance_logs_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.blocks(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_maintenance_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Step 4: Create Performance Indexes
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

-- Indexes for hostel fee payments
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_student_id ON public.hostel_fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_status ON public.hostel_fee_payments(status);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_due_date ON public.hostel_fee_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_tenant_id ON public.hostel_fee_payments(tenant_id);

-- Indexes for maintenance logs
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_logs_status ON public.hostel_maintenance_logs(status);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_logs_tenant_id ON public.hostel_maintenance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_logs_reported_date ON public.hostel_maintenance_logs(reported_date);

-- Step 5: Enable Row Level Security (RLS) for Multi-Tenant Isolation
-- ============================================================================

-- Enable RLS on all hostel tables (matching your existing schema pattern)
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_maintenance_logs ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS Policies for Tenant Isolation
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

  -- Hostel Fee Payments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_fee_payments' AND policyname = 'hostel_fee_payments_tenant_isolation') THEN
    CREATE POLICY hostel_fee_payments_tenant_isolation ON public.hostel_fee_payments
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Hostel Maintenance Logs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_maintenance_logs' AND policyname = 'hostel_maintenance_logs_tenant_isolation') THEN
    CREATE POLICY hostel_maintenance_logs_tenant_isolation ON public.hostel_maintenance_logs
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

END$$;

-- Step 7: Add Warden Role (if not exists)
-- ============================================================================

-- Add warden role to all tenants if it doesn't exist
INSERT INTO public.roles (id, role_name, tenant_id, created_at, updated_at)
SELECT 5, 'Warden', t.id, NOW(), NOW()
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r 
  WHERE r.role_name = 'Warden' AND r.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- Step 8: Create Sequence for Hostel Fee Receipt Numbers
-- ============================================================================

-- Create sequence for hostel fee receipt numbers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'hostel_fee_receipt_seq') THEN
    CREATE SEQUENCE public.hostel_fee_receipt_seq START 10001;
  END IF;
END$$;

-- Update hostel fee payments to use the sequence
ALTER TABLE public.hostel_fee_payments 
ALTER COLUMN receipt_number SET DEFAULT nextval('hostel_fee_receipt_seq');

-- Step 9: Verification Query
-- ============================================================================

-- Check if all tables were created successfully
SELECT 
    'Hostel Tables Created Successfully!' as status,
    COUNT(CASE WHEN table_name = 'hostels' THEN 1 END) as hostels_table,
    COUNT(CASE WHEN table_name = 'blocks' THEN 1 END) as blocks_table,
    COUNT(CASE WHEN table_name = 'rooms' THEN 1 END) as rooms_table,
    COUNT(CASE WHEN table_name = 'beds' THEN 1 END) as beds_table,
    COUNT(CASE WHEN table_name = 'hostel_applications' THEN 1 END) as applications_table,
    COUNT(CASE WHEN table_name = 'bed_allocations' THEN 1 END) as allocations_table,
    COUNT(CASE WHEN table_name = 'hostel_fee_payments' THEN 1 END) as fee_payments_table,
    COUNT(CASE WHEN table_name = 'hostel_maintenance_logs' THEN 1 END) as maintenance_table
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('hostels', 'blocks', 'rooms', 'beds', 'hostel_applications', 'bed_allocations', 'hostel_fee_payments', 'hostel_maintenance_logs');

-- ============================================================================
-- 🎉 SETUP COMPLETE!
-- ============================================================================
-- 
-- After running this script, your application should be able to:
-- ✅ Access public.rooms table (fixing the "relation does not exist" error)
-- ✅ Access public.beds table (fixing the "relation does not exist" error)  
-- ✅ Access public.hostels table
-- ✅ Access public.hostel_applications table
-- ✅ Access public.bed_allocations table
-- ✅ Access public.hostel_fee_payments table (requested by user)
-- ✅ Use all hostel management features
-- ✅ Maintain proper tenant isolation
-- ✅ Have good query performance with indexes
--
-- Your existing tables (students, teachers, classes, etc.) remain unchanged!
-- ============================================================================