-- Hostel Acceptance Tracking System Schema
-- Designed for multi-tenant environment with Supabase/PostgreSQL
-- Compatible with existing school management system

-- ===============================
-- 1. HOSTEL STRUCTURE TABLES
-- ===============================

-- Hostels table
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  contact_phone text,
  hostel_type text DEFAULT 'mixed' CHECK (hostel_type IN ('boys', 'girls', 'mixed')),
  capacity integer DEFAULT 0,
  warden_id uuid, -- Reference to users table with warden role
  description text,
  amenities text[], -- Array of amenities
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostels_pkey PRIMARY KEY (id),
  CONSTRAINT hostels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT hostels_warden_id_fkey FOREIGN KEY (warden_id) REFERENCES public.users(id)
);

-- Blocks table
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
  room_type text DEFAULT 'standard' CHECK (room_type IN ('standard', 'deluxe', 'premium', 'accessible')),
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
  bed_type text DEFAULT 'normal' CHECK (bed_type IN ('normal', 'lower', 'upper', 'accessible')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT beds_pkey PRIMARY KEY (id),
  CONSTRAINT beds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE,
  CONSTRAINT beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT beds_unique_label_per_room UNIQUE (room_id, bed_label)
);

-- ===============================
-- 2. APPLICATION & ALLOCATION TABLES
-- ===============================

-- Hostel Applications table
CREATE TABLE IF NOT EXISTS public.hostel_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  academic_year text NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE))::text,
  preferred_room_type text DEFAULT 'standard',
  preferred_block_id uuid,
  special_requirements text,
  documents jsonb DEFAULT '[]'::jsonb, -- Array of document objects
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'accepted', 'rejected', 'waitlisted', 'cancelled')),
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

-- Bed Allocations table
CREATE TABLE IF NOT EXISTS public.bed_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  student_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  academic_year text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending_acceptance' CHECK (status IN ('pending_acceptance', 'active', 'checked_in', 'checked_out', 'cancelled', 'transferred')),
  acceptance_deadline timestamp with time zone, -- When student must respond
  student_response text CHECK (student_response IN ('accepted', 'rejected')),
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

-- Bed History table (immutable log of all bed usage)
CREATE TABLE IF NOT EXISTS public.bed_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL,
  student_id uuid,
  allocation_id uuid,
  start_date date NOT NULL,
  end_date date,
  action text NOT NULL CHECK (action IN ('assigned', 'checked_in', 'checked_out', 'transferred_in', 'transferred_out', 'maintenance_start', 'maintenance_end')),
  notes text,
  performed_by uuid, -- User who performed the action
  created_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT bed_history_pkey PRIMARY KEY (id),
  CONSTRAINT bed_history_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id),
  CONSTRAINT bed_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT bed_history_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.bed_allocations(id),
  CONSTRAINT bed_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id),
  CONSTRAINT bed_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Waitlist table
CREATE TABLE IF NOT EXISTS public.hostel_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  priority_score integer DEFAULT 1000,
  added_at timestamp with time zone DEFAULT now(),
  removed_at timestamp with time zone,
  removal_reason text,
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_waitlist_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id),
  CONSTRAINT hostel_waitlist_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id),
  CONSTRAINT hostel_waitlist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- ===============================
-- 3. MAINTENANCE & LOGS TABLES
-- ===============================

-- Maintenance logs
CREATE TABLE IF NOT EXISTS public.hostel_maintenance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  hostel_id uuid,
  room_id uuid,
  bed_id uuid,
  issue_type text NOT NULL CHECK (issue_type IN ('electrical', 'plumbing', 'furniture', 'cleanliness', 'structural', 'other')),
  issue_description text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  reported_by uuid NOT NULL,
  assigned_to uuid,
  status text DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'in_progress', 'resolved', 'cancelled')),
  scheduled_for timestamp with time zone,
  resolved_at timestamp with time zone,
  resolution_notes text,
  cost numeric DEFAULT 0,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_maintenance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_maintenance_logs_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id),
  CONSTRAINT hostel_maintenance_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT hostel_maintenance_logs_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.beds(id),
  CONSTRAINT hostel_maintenance_logs_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id),
  CONSTRAINT hostel_maintenance_logs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
  CONSTRAINT hostel_maintenance_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Hostel Fees table
CREATE TABLE IF NOT EXISTS public.hostel_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  allocation_id uuid NOT NULL,
  academic_year text NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('monthly_rent', 'security_deposit', 'maintenance_fee', 'electricity', 'food', 'other')),
  amount numeric NOT NULL,
  due_date date NOT NULL,
  paid_amount numeric DEFAULT 0,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue', 'waived')),
  payment_date timestamp with time zone,
  payment_method text,
  transaction_id text,
  late_fee numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tenant_id uuid NOT NULL,
  CONSTRAINT hostel_fees_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_fees_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id),
  CONSTRAINT hostel_fees_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.bed_allocations(id),
  CONSTRAINT hostel_fees_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- ===============================
-- 4. INDEXES FOR PERFORMANCE
-- ===============================

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hostels_tenant_id ON public.hostels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostels_warden_id ON public.hostels(warden_id);
CREATE INDEX IF NOT EXISTS idx_blocks_hostel_id ON public.blocks(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_hostel_id ON public.rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_rooms_block_id ON public.rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON public.beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_status ON public.beds(status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_student_id ON public.hostel_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_status ON public.hostel_applications(status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_hostel_id ON public.hostel_applications(hostel_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_bed_id ON public.bed_allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_student_id ON public.bed_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_bed_allocations_status ON public.bed_allocations(status);
CREATE INDEX IF NOT EXISTS idx_bed_history_bed_id ON public.bed_history(bed_id);
CREATE INDEX IF NOT EXISTS idx_bed_history_student_id ON public.bed_history(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_hostel_id ON public.hostel_waitlist(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_priority_score ON public.hostel_waitlist(priority_score);
CREATE INDEX IF NOT EXISTS idx_hostel_fees_student_id ON public.hostel_fees(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_fees_payment_status ON public.hostel_fees(payment_status);

-- ===============================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ===============================

-- Enable RLS on all tables
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bed_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_fees ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant isolation
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

  -- Rooms policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_tenant_isolation') THEN
    CREATE POLICY rooms_tenant_isolation ON public.rooms
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Beds policies
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

  -- Bed History policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bed_history' AND policyname = 'bed_history_tenant_isolation') THEN
    CREATE POLICY bed_history_tenant_isolation ON public.bed_history
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Waitlist policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_waitlist' AND policyname = 'hostel_waitlist_tenant_isolation') THEN
    CREATE POLICY hostel_waitlist_tenant_isolation ON public.hostel_waitlist
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Maintenance Logs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_maintenance_logs' AND policyname = 'hostel_maintenance_logs_tenant_isolation') THEN
    CREATE POLICY hostel_maintenance_logs_tenant_isolation ON public.hostel_maintenance_logs
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

  -- Hostel Fees policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_fees' AND policyname = 'hostel_fees_tenant_isolation') THEN
    CREATE POLICY hostel_fees_tenant_isolation ON public.hostel_fees
    FOR ALL TO authenticated
    USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
  END IF;

END$$;

-- ===============================
-- 6. USEFUL VIEWS FOR REPORTING
-- ===============================

-- View for current hostel occupancy
CREATE OR REPLACE VIEW public.v_hostel_occupancy AS
SELECT 
    h.id as hostel_id,
    h.name as hostel_name,
    h.tenant_id,
    COUNT(DISTINCT r.id) as total_rooms,
    COUNT(DISTINCT b.id) as total_beds,
    COUNT(DISTINCT CASE WHEN b.status = 'occupied' THEN b.id END) as occupied_beds,
    COUNT(DISTINCT CASE WHEN b.status = 'available' THEN b.id END) as available_beds,
    COUNT(DISTINCT CASE WHEN b.status = 'maintenance' THEN b.id END) as maintenance_beds,
    ROUND(
        CASE 
            WHEN COUNT(DISTINCT b.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN b.status = 'occupied' THEN b.id END)::numeric / COUNT(DISTINCT b.id)::numeric) * 100
            ELSE 0 
        END, 2
    ) as occupancy_percentage
FROM public.hostels h
LEFT JOIN public.rooms r ON h.id = r.hostel_id AND r.is_active = true
LEFT JOIN public.beds b ON r.id = b.room_id
WHERE h.is_active = true
GROUP BY h.id, h.name, h.tenant_id;

-- View for pending applications summary
CREATE OR REPLACE VIEW public.v_pending_applications AS
SELECT 
    ha.hostel_id,
    h.name as hostel_name,
    ha.tenant_id,
    COUNT(*) as pending_count,
    COUNT(CASE WHEN ha.status = 'submitted' THEN 1 END) as submitted_count,
    COUNT(CASE WHEN ha.status = 'verified' THEN 1 END) as verified_count,
    COUNT(CASE WHEN ha.status = 'waitlisted' THEN 1 END) as waitlisted_count
FROM public.hostel_applications ha
JOIN public.hostels h ON ha.hostel_id = h.id
WHERE ha.status IN ('submitted', 'verified', 'waitlisted')
GROUP BY ha.hostel_id, h.name, ha.tenant_id;

-- Comments for documentation
COMMENT ON TABLE public.hostels IS 'Main hostels table containing hostel information';
COMMENT ON TABLE public.blocks IS 'Hostel blocks/wings within each hostel';
COMMENT ON TABLE public.rooms IS 'Individual rooms within blocks';
COMMENT ON TABLE public.beds IS 'Individual beds within rooms with their current status';
COMMENT ON TABLE public.hostel_applications IS 'Student applications for hostel accommodation';
COMMENT ON TABLE public.bed_allocations IS 'Current and historical bed allocations to students';
COMMENT ON TABLE public.bed_history IS 'Immutable log of all bed usage history';
COMMENT ON TABLE public.hostel_waitlist IS 'Students waiting for bed allocation';
COMMENT ON TABLE public.hostel_maintenance_logs IS 'Maintenance requests and their status';
COMMENT ON TABLE public.hostel_fees IS 'Hostel-related fee records and payments';

-- Success message
SELECT 'Hostel Management System schema created successfully!' as message;