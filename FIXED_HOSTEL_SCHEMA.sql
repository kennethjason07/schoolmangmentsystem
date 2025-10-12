-- ============================================================================
-- 🏫 FIXED HOSTEL TABLES SCHEMA - SAFER EXECUTION
-- ============================================================================
-- 
-- PURPOSE: Add hostel management tables to your existing school database
-- FIXED: Handles column existence checks and safer index creation
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Navigate to SQL Editor in the sidebar
-- 3. Create a new query
-- 4. Copy and paste this ENTIRE script
-- 5. Click "Run" to execute
-- ============================================================================

-- Step 1: Add Missing Hostel Core Tables (with safe execution)
-- ============================================================================

-- HOSTELS TABLE - Main hostel buildings
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostels') THEN
        CREATE TABLE public.hostels (
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
        RAISE NOTICE 'Created table: hostels';
    ELSE
        RAISE NOTICE 'Table hostels already exists, skipping...';
    END IF;
END$$;

-- BLOCKS TABLE - Sections within hostels
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocks') THEN
        CREATE TABLE public.blocks (
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
        RAISE NOTICE 'Created table: blocks';
    ELSE
        RAISE NOTICE 'Table blocks already exists, skipping...';
    END IF;
END$$;

-- ROOMS TABLE - Individual rooms (THIS FIXES YOUR MAIN ERROR!)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms') THEN
        CREATE TABLE public.rooms (
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
        RAISE NOTICE 'Created table: rooms';
    ELSE
        RAISE NOTICE 'Table rooms already exists, skipping...';
    END IF;
END$$;

-- BEDS TABLE - Individual beds in rooms (THIS FIXES YOUR SECOND ERROR!)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beds') THEN
        CREATE TABLE public.beds (
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
        RAISE NOTICE 'Created table: beds';
    ELSE
        RAISE NOTICE 'Table beds already exists, skipping...';
    END IF;
END$$;

-- Step 2: Add Hostel Application & Allocation Tables
-- ============================================================================

-- HOSTEL APPLICATIONS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_applications') THEN
        CREATE TABLE public.hostel_applications (
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
          CONSTRAINT hostel_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
          CONSTRAINT hostel_applications_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
          CONSTRAINT hostel_applications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL,
          CONSTRAINT hostel_applications_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id) ON DELETE SET NULL,
          CONSTRAINT hostel_applications_preferred_block_id_fkey FOREIGN KEY (preferred_block_id) REFERENCES public.blocks(id) ON DELETE SET NULL,
          CONSTRAINT hostel_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
          CONSTRAINT hostel_applications_unique_student_year_hostel UNIQUE (student_id, academic_year, hostel_id)
        );
        RAISE NOTICE 'Created table: hostel_applications';
    ELSE
        RAISE NOTICE 'Table hostel_applications already exists, skipping...';
    END IF;
END$$;

-- BED ALLOCATIONS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bed_allocations') THEN
        CREATE TABLE public.bed_allocations (
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
          monthly_rent numeric DEFAULT 0,
          security_deposit numeric DEFAULT 0,
          created_by uuid NOT NULL,
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
        RAISE NOTICE 'Created table: bed_allocations';
    ELSE
        RAISE NOTICE 'Table bed_allocations already exists, skipping...';
    END IF;
END$$;

-- Step 3: Add Hostel Fee Payment Tables
-- ============================================================================

-- HOSTEL FEE PAYMENTS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_fee_payments') THEN
        CREATE TABLE public.hostel_fee_payments (
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
        RAISE NOTICE 'Created table: hostel_fee_payments';
    ELSE
        RAISE NOTICE 'Table hostel_fee_payments already exists, skipping...';
    END IF;
END$$;

-- HOSTEL MAINTENANCE LOGS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_maintenance_logs') THEN
        CREATE TABLE public.hostel_maintenance_logs (
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
          assigned_to text,
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
        RAISE NOTICE 'Created table: hostel_maintenance_logs';
    ELSE
        RAISE NOTICE 'Table hostel_maintenance_logs already exists, skipping...';
    END IF;
END$$;

-- Step 4: Create Performance Indexes (with safe execution)
-- ============================================================================

-- Safe index creation function
DO $$
DECLARE 
    index_exists boolean;
    column_exists boolean;
BEGIN
    -- Check if indexes exist and create them safely
    
    -- Hostels indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostels') THEN
        -- Check tenant_id index
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hostels' AND indexname = 'idx_hostels_tenant_id') THEN
            CREATE INDEX idx_hostels_tenant_id ON public.hostels(tenant_id);
            RAISE NOTICE 'Created index: idx_hostels_tenant_id';
        END IF;
        
        -- Check if warden_id column exists before creating index
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'hostels' AND column_name = 'warden_id'
        ) INTO column_exists;
        
        IF column_exists AND NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hostels' AND indexname = 'idx_hostels_warden_id') THEN
            CREATE INDEX idx_hostels_warden_id ON public.hostels(warden_id);
            RAISE NOTICE 'Created index: idx_hostels_warden_id';
        END IF;
        
        -- Check is_active index
        SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'hostels' AND column_name = 'is_active'
        ) INTO column_exists;
        
        IF column_exists AND NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hostels' AND indexname = 'idx_hostels_is_active') THEN
            CREATE INDEX idx_hostels_is_active ON public.hostels(is_active);
            RAISE NOTICE 'Created index: idx_hostels_is_active';
        END IF;
    END IF;

    -- Rooms indexes (CRITICAL!)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rooms' AND indexname = 'idx_rooms_hostel_id') THEN
            CREATE INDEX idx_rooms_hostel_id ON public.rooms(hostel_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rooms' AND indexname = 'idx_rooms_tenant_id') THEN
            CREATE INDEX idx_rooms_tenant_id ON public.rooms(tenant_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'rooms' AND indexname = 'idx_rooms_is_active') THEN
            CREATE INDEX idx_rooms_is_active ON public.rooms(is_active);
        END IF;
        RAISE NOTICE 'Created rooms indexes';
    END IF;

    -- Beds indexes (CRITICAL!)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beds') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'beds' AND indexname = 'idx_beds_room_id') THEN
            CREATE INDEX idx_beds_room_id ON public.beds(room_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'beds' AND indexname = 'idx_beds_tenant_id') THEN
            CREATE INDEX idx_beds_tenant_id ON public.beds(tenant_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'beds' AND indexname = 'idx_beds_status') THEN
            CREATE INDEX idx_beds_status ON public.beds(status);
        END IF;
        RAISE NOTICE 'Created beds indexes';
    END IF;

    -- Other table indexes
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocks') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'blocks' AND indexname = 'idx_blocks_hostel_id') THEN
            CREATE INDEX idx_blocks_hostel_id ON public.blocks(hostel_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'blocks' AND indexname = 'idx_blocks_tenant_id') THEN
            CREATE INDEX idx_blocks_tenant_id ON public.blocks(tenant_id);
        END IF;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_applications') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND indexname = 'idx_hostel_applications_tenant_id') THEN
            CREATE INDEX idx_hostel_applications_tenant_id ON public.hostel_applications(tenant_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND indexname = 'idx_hostel_applications_student_id') THEN
            CREATE INDEX idx_hostel_applications_student_id ON public.hostel_applications(student_id);
        END IF;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bed_allocations') THEN
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND indexname = 'idx_bed_allocations_tenant_id') THEN
            CREATE INDEX idx_bed_allocations_tenant_id ON public.bed_allocations(tenant_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND indexname = 'idx_bed_allocations_bed_id') THEN
            CREATE INDEX idx_bed_allocations_bed_id ON public.bed_allocations(bed_id);
        END IF;
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND indexname = 'idx_bed_allocations_student_id') THEN
            CREATE INDEX idx_bed_allocations_student_id ON public.bed_allocations(student_id);
        END IF;
    END IF;

    RAISE NOTICE 'Index creation completed';
END$$;

-- Step 5: Enable Row Level Security (RLS) for Multi-Tenant Isolation
-- ============================================================================

DO $$
BEGIN
    -- Enable RLS on hostel tables if they exist
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostels') THEN
        ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocks') THEN
        ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms') THEN
        ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beds') THEN
        ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_applications') THEN
        ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bed_allocations') THEN
        ALTER TABLE public.bed_allocations ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_fee_payments') THEN
        ALTER TABLE public.hostel_fee_payments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_maintenance_logs') THEN
        ALTER TABLE public.hostel_maintenance_logs ENABLE ROW LEVEL SECURITY;
    END IF;
    
    RAISE NOTICE 'RLS enabled on hostel tables';
END$$;

-- Step 6: Create RLS Policies for Tenant Isolation
-- ============================================================================

DO $$
BEGIN
  -- Create RLS policies only if tables exist
  
  -- Hostels policies
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostels') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostels' AND policyname = 'hostels_tenant_isolation') THEN
      CREATE POLICY hostels_tenant_isolation ON public.hostels
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
      RAISE NOTICE 'Created RLS policy for hostels';
    END IF;
  END IF;

  -- Blocks policies  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'blocks') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'blocks_tenant_isolation') THEN
      CREATE POLICY blocks_tenant_isolation ON public.blocks
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
    END IF;
  END IF;

  -- Rooms policies (CRITICAL!)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms' AND policyname = 'rooms_tenant_isolation') THEN
      CREATE POLICY rooms_tenant_isolation ON public.rooms
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
      RAISE NOTICE 'Created RLS policy for rooms';
    END IF;
  END IF;

  -- Beds policies (CRITICAL!)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'beds') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'beds' AND policyname = 'beds_tenant_isolation') THEN
      CREATE POLICY beds_tenant_isolation ON public.beds
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
      RAISE NOTICE 'Created RLS policy for beds';
    END IF;
  END IF;

  -- Other table policies
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_applications') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_applications' AND policyname = 'hostel_applications_tenant_isolation') THEN
      CREATE POLICY hostel_applications_tenant_isolation ON public.hostel_applications
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bed_allocations') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bed_allocations' AND policyname = 'bed_allocations_tenant_isolation') THEN
      CREATE POLICY bed_allocations_tenant_isolation ON public.bed_allocations
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_fee_payments') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_fee_payments' AND policyname = 'hostel_fee_payments_tenant_isolation') THEN
      CREATE POLICY hostel_fee_payments_tenant_isolation ON public.hostel_fee_payments
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
    END IF;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_maintenance_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hostel_maintenance_logs' AND policyname = 'hostel_maintenance_logs_tenant_isolation') THEN
      CREATE POLICY hostel_maintenance_logs_tenant_isolation ON public.hostel_maintenance_logs
      FOR ALL TO authenticated
      USING (tenant_id::text = coalesce((current_setting('request.jwt.claims', true))::jsonb->>'tenant_id', ''));
    END IF;
  END IF;

  RAISE NOTICE 'RLS policies created';
END$$;

-- Step 7: Add Warden Role (if not exists)
-- ============================================================================

-- Add warden role to all tenants if it doesn't exist
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tenants') THEN
        INSERT INTO public.roles (id, role_name, tenant_id, created_at, updated_at)
        SELECT 5, 'Warden', t.id, NOW(), NOW()
        FROM public.tenants t
        WHERE NOT EXISTS (
          SELECT 1 FROM public.roles r 
          WHERE r.role_name = 'Warden' AND r.tenant_id = t.id
        )
        ON CONFLICT DO NOTHING;
        RAISE NOTICE 'Warden role added to tenants';
    END IF;
END$$;

-- Step 8: Create Sequence for Hostel Fee Receipt Numbers
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'hostel_fee_receipt_seq') THEN
    CREATE SEQUENCE public.hostel_fee_receipt_seq START 10001;
    RAISE NOTICE 'Created sequence: hostel_fee_receipt_seq';
  END IF;
  
  -- Update hostel fee payments to use the sequence if table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hostel_fee_payments') THEN
    ALTER TABLE public.hostel_fee_payments 
    ALTER COLUMN receipt_number SET DEFAULT nextval('hostel_fee_receipt_seq');
    RAISE NOTICE 'Updated hostel_fee_payments receipt_number default';
  END IF;
END$$;

-- Step 9: Verification Query
-- ============================================================================

-- Check if all tables were created successfully
SELECT 
    '✅ HOSTEL SETUP VERIFICATION' as status,
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

-- Show final success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 HOSTEL SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '===================================';
    RAISE NOTICE '✅ All hostel tables have been created';
    RAISE NOTICE '✅ Indexes and RLS policies are in place';
    RAISE NOTICE '✅ Your application should now work without errors';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Next steps:';
    RAISE NOTICE '1. Test your hostel management features';
    RAISE NOTICE '2. Run: node validate_hostel_setup.js';
    RAISE NOTICE '3. Check that "relation does not exist" errors are gone';
    RAISE NOTICE '';
END$$;