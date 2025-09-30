-- Hostel Management Schema for School Management System
-- Aligned with existing schema patterns and conventions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HOSTEL INFRASTRUCTURE TABLES
-- ============================================================================

-- Hostels table
CREATE TABLE IF NOT EXISTS public.hostels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  hostel_type text CHECK (hostel_type IN ('boys','girls','mixed')) DEFAULT 'mixed',
  capacity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  contact_phone text,
  address text,
  warden_name text,
  warden_phone text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostels_pkey PRIMARY KEY (id),
  CONSTRAINT hostels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Blocks table (optional organizational structure)
CREATE TABLE IF NOT EXISTS public.hostel_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  floor_count integer DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_blocks_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_blocks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_blocks_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE
);

-- Rooms table
CREATE TABLE IF NOT EXISTS public.hostel_rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  block_id uuid,
  floor integer,
  room_number text NOT NULL,
  room_type text CHECK (room_type IN ('single','double','triple','quad')) DEFAULT 'double',
  capacity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  monthly_rent numeric(10,2),
  amenities jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_rooms_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_rooms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_rooms_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT hostel_rooms_block_id_fkey FOREIGN KEY (block_id) REFERENCES public.hostel_blocks(id) ON DELETE SET NULL,
  CONSTRAINT hostel_rooms_unique_number UNIQUE (hostel_id, room_number)
);

-- Beds table
CREATE TABLE IF NOT EXISTS public.hostel_beds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  room_id uuid NOT NULL,
  bed_label text NOT NULL,           -- e.g. "1", "2", "A", "B"
  bed_type text CHECK (bed_type IN ('normal','bunk','deluxe')) DEFAULT 'normal',
  status text CHECK (status IN ('available','reserved','occupied','maintenance')) NOT NULL DEFAULT 'available',
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_beds_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_beds_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_beds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  CONSTRAINT hostel_beds_unique_label UNIQUE (room_id, bed_label)
);

-- ============================================================================
-- HOSTEL APPLICATION AND ALLOCATION TABLES
-- ============================================================================

-- Hostel Applications table
CREATE TABLE IF NOT EXISTS public.hostel_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  hostel_id uuid,
  status text CHECK (status IN ('submitted','verified','accepted','rejected','waitlisted')) NOT NULL DEFAULT 'submitted',
  academic_year text NOT NULL,
  preferred_room_type text,
  medical_conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  parent_consent boolean DEFAULT false,
  remarks text,
  applied_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_by uuid,
  verified_at timestamp with time zone,
  decision_by uuid,
  decision_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_applications_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_applications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT hostel_applications_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE SET NULL,
  CONSTRAINT hostel_applications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_applications_decision_by_fkey FOREIGN KEY (decision_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Hostel Waitlist table
CREATE TABLE IF NOT EXISTS public.hostel_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  application_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  priority_score integer NOT NULL DEFAULT 1000,
  notes text,
  added_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at timestamp with time zone,
  removal_reason text CHECK (removal_reason IN ('allocated','rejected','withdrawn','expired')),
  CONSTRAINT hostel_waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_waitlist_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_waitlist_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id) ON DELETE CASCADE,
  CONSTRAINT hostel_waitlist_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE
);

-- Bed Allocations table
CREATE TABLE IF NOT EXISTS public.hostel_bed_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  application_id uuid,
  student_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  academic_year text NOT NULL,
  monthly_rent numeric(10,2),
  security_deposit numeric(10,2),
  status text CHECK (status IN ('pending_acceptance','active','cancelled','ended','suspended')) NOT NULL DEFAULT 'pending_acceptance',
  acceptance_deadline timestamp with time zone,
  student_response text CHECK (student_response IN ('accepted','rejected')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_bed_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_bed_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_bed_allocations_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.hostel_applications(id) ON DELETE SET NULL,
  CONSTRAINT hostel_bed_allocations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT hostel_bed_allocations_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.hostel_beds(id) ON DELETE RESTRICT,
  CONSTRAINT hostel_bed_allocations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- ============================================================================
-- HOSTEL MAINTENANCE AND OPERATIONS TABLES
-- ============================================================================

-- Maintenance Logs table
CREATE TABLE IF NOT EXISTS public.hostel_maintenance_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  hostel_id uuid NOT NULL,
  room_id uuid,
  bed_id uuid,
  issue_type text CHECK (issue_type IN ('electrical','plumbing','furniture','structural','cleaning','security','internet','other')) NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text NOT NULL,
  priority text CHECK (priority IN ('low','medium','high','urgent')) NOT NULL DEFAULT 'medium',
  status text CHECK (status IN ('reported','assigned','in_progress','completed','cancelled')) NOT NULL DEFAULT 'reported',
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  assigned_to uuid,
  completed_by uuid,
  reporter_name text,
  reporter_contact text,
  reported_by uuid,
  reported_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_maintenance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_maintenance_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES public.hostels(id) ON DELETE CASCADE,
  CONSTRAINT hostel_maintenance_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hostel_rooms(id) ON DELETE SET NULL,
  CONSTRAINT hostel_maintenance_logs_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.hostel_beds(id) ON DELETE SET NULL,
  CONSTRAINT hostel_maintenance_logs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_maintenance_logs_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT hostel_maintenance_logs_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Bed History table (audit trail)
CREATE TABLE IF NOT EXISTS public.hostel_bed_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  bed_id uuid NOT NULL,
  student_id uuid,
  allocation_id uuid,
  action text CHECK (action IN ('assigned','cancelled','ended','maintenance','released','transferred')) NOT NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  performed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_bed_history_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_bed_history_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_bed_history_bed_id_fkey FOREIGN KEY (bed_id) REFERENCES public.hostel_beds(id) ON DELETE CASCADE,
  CONSTRAINT hostel_bed_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL,
  CONSTRAINT hostel_bed_history_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.hostel_bed_allocations(id) ON DELETE SET NULL,
  CONSTRAINT hostel_bed_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Hostel Fee Payments table (extends the existing student_fees pattern)
CREATE TABLE IF NOT EXISTS public.hostel_fee_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  student_id uuid NOT NULL,
  allocation_id uuid,
  academic_year text NOT NULL,
  fee_type text NOT NULL CHECK (fee_type IN ('monthly_rent','security_deposit','admission_fee','maintenance_fee','other')),
  amount_due numeric(10,2) NOT NULL,
  amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  payment_mode text CHECK (payment_mode IN ('Cash','Card','Online','UPI')) DEFAULT 'Cash',
  status text CHECK (status IN ('pending','partial','paid','overdue','cancelled')) DEFAULT 'pending',
  receipt_number text UNIQUE,
  remarks text,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT hostel_fee_payments_pkey PRIMARY KEY (id),
  CONSTRAINT hostel_fee_payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT hostel_fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
  CONSTRAINT hostel_fee_payments_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.hostel_bed_allocations(id) ON DELETE SET NULL
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Hostels indexes
CREATE INDEX IF NOT EXISTS idx_hostels_tenant ON public.hostels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostels_active ON public.hostels(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hostels_type ON public.hostels(tenant_id, hostel_type);

-- Blocks indexes
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_tenant ON public.hostel_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_hostel ON public.hostel_blocks(hostel_id);

-- Rooms indexes
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_tenant ON public.hostel_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_hostel ON public.hostel_rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_active ON public.hostel_rooms(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_block ON public.hostel_rooms(block_id);

-- Beds indexes
CREATE INDEX IF NOT EXISTS idx_hostel_beds_tenant ON public.hostel_beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_room ON public.hostel_beds(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_status ON public.hostel_beds(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_available ON public.hostel_beds(tenant_id, room_id) WHERE status = 'available';

-- Applications indexes
CREATE INDEX IF NOT EXISTS idx_hostel_applications_tenant ON public.hostel_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_student ON public.hostel_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_hostel ON public.hostel_applications(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_status ON public.hostel_applications(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_year ON public.hostel_applications(tenant_id, academic_year);

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_tenant ON public.hostel_waitlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_hostel ON public.hostel_waitlist(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_active ON public.hostel_waitlist(hostel_id, removed_at);
CREATE INDEX IF NOT EXISTS idx_hostel_waitlist_priority ON public.hostel_waitlist(hostel_id, priority_score) WHERE removed_at IS NULL;

-- Allocations indexes
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_tenant ON public.hostel_bed_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_student ON public.hostel_bed_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_bed ON public.hostel_bed_allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_status ON public.hostel_bed_allocations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_year ON public.hostel_bed_allocations(tenant_id, academic_year);

-- Maintenance indexes
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_tenant ON public.hostel_maintenance_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_hostel ON public.hostel_maintenance_logs(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_status ON public.hostel_maintenance_logs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_priority ON public.hostel_maintenance_logs(tenant_id, priority);
CREATE INDEX IF NOT EXISTS idx_hostel_maintenance_open ON public.hostel_maintenance_logs(tenant_id, hostel_id) WHERE status IN ('reported','assigned','in_progress');

-- History indexes
CREATE INDEX IF NOT EXISTS idx_hostel_bed_history_tenant ON public.hostel_bed_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_bed_history_bed ON public.hostel_bed_history(bed_id);
CREATE INDEX IF NOT EXISTS idx_hostel_bed_history_student ON public.hostel_bed_history(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_bed_history_date ON public.hostel_bed_history(tenant_id, start_date);

-- Fee payments indexes
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_tenant ON public.hostel_fee_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_student ON public.hostel_fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_status ON public.hostel_fee_payments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hostel_fee_payments_due_date ON public.hostel_fee_payments(tenant_id, due_date) WHERE status IN ('pending','partial','overdue');

-- ============================================================================
-- UNIQUE CONSTRAINTS FOR BUSINESS LOGIC
-- ============================================================================

-- Ensure a bed can't be double-booked while active/pending
CREATE UNIQUE INDEX IF NOT EXISTS uidx_hostel_bed_live_allocation
ON public.hostel_bed_allocations(bed_id)
WHERE status IN ('pending_acceptance','active');

-- Ensure one active application per student per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uidx_hostel_application_student_year
ON public.hostel_applications(tenant_id, student_id, academic_year)
WHERE status IN ('submitted','verified','accepted','waitlisted');

-- ============================================================================
-- USEFUL VIEWS FOR REPORTING AND ANALYTICS
-- ============================================================================

-- Hostel Occupancy View
CREATE OR REPLACE VIEW public.v_hostel_occupancy AS
SELECT
  h.tenant_id,
  h.id as hostel_id,
  h.name as hostel_name,
  h.hostel_type,
  h.capacity as total_capacity,
  COALESCE(room_stats.total_beds, 0) as total_beds,
  COALESCE(room_stats.occupied_beds, 0) as occupied_beds,
  COALESCE(room_stats.available_beds, 0) as available_beds,
  COALESCE(room_stats.maintenance_beds, 0) as maintenance_beds,
  CASE
    WHEN COALESCE(room_stats.total_beds, 0) > 0 
    THEN ROUND((COALESCE(room_stats.occupied_beds, 0)::numeric / room_stats.total_beds::numeric) * 100, 2)
    ELSE 0
  END as occupancy_percentage
FROM public.hostels h
LEFT JOIN (
  SELECT 
    hr.hostel_id,
    COUNT(hb.id) as total_beds,
    COUNT(hb.id) FILTER (WHERE hb.status = 'occupied') as occupied_beds,
    COUNT(hb.id) FILTER (WHERE hb.status = 'available') as available_beds,
    COUNT(hb.id) FILTER (WHERE hb.status = 'maintenance') as maintenance_beds
  FROM public.hostel_rooms hr
  JOIN public.hostel_beds hb ON hb.room_id = hr.id
  WHERE hr.is_active = true
  GROUP BY hr.hostel_id
) room_stats ON room_stats.hostel_id = h.id
WHERE h.is_active = true;

-- Room Occupancy View
CREATE OR REPLACE VIEW public.v_room_occupancy AS
SELECT
  hr.tenant_id,
  hr.id as room_id,
  hr.hostel_id,
  hr.room_number,
  hr.room_type,
  hr.capacity as room_capacity,
  COUNT(hb.id) as total_beds,
  COUNT(hb.id) FILTER (WHERE hb.status = 'occupied') as occupied_beds,
  COUNT(hb.id) FILTER (WHERE hb.status = 'available') as available_beds,
  COUNT(hb.id) FILTER (WHERE hb.status = 'maintenance') as maintenance_beds,
  CASE
    WHEN COUNT(hb.id) > 0 
    THEN ROUND((COUNT(hb.id) FILTER (WHERE hb.status = 'occupied')::numeric / COUNT(hb.id)::numeric) * 100, 2)
    ELSE 0
  END as occupancy_percentage
FROM public.hostel_rooms hr
LEFT JOIN public.hostel_beds hb ON hb.room_id = hr.id
WHERE hr.is_active = true
GROUP BY hr.tenant_id, hr.id, hr.hostel_id, hr.room_number, hr.room_type, hr.capacity;

-- Student Hostel Info View
CREATE OR REPLACE VIEW public.v_student_hostel_info AS
SELECT
  s.id as student_id,
  s.tenant_id,
  s.admission_no,
  s.name as student_name,
  s.class_id,
  hba.id as allocation_id,
  h.id as hostel_id,
  h.name as hostel_name,
  hr.room_number,
  hb.bed_label,
  hba.status as allocation_status,
  hba.start_date,
  hba.end_date,
  hba.monthly_rent,
  hba.academic_year
FROM public.students s
LEFT JOIN public.hostel_bed_allocations hba ON hba.student_id = s.id AND hba.status IN ('active','pending_acceptance')
LEFT JOIN public.hostel_beds hb ON hb.id = hba.bed_id
LEFT JOIN public.hostel_rooms hr ON hr.id = hb.room_id
LEFT JOIN public.hostels h ON h.id = hr.hostel_id;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.hostels IS 'Main hostel buildings/facilities';
COMMENT ON TABLE public.hostel_blocks IS 'Optional organizational blocks within hostels';
COMMENT ON TABLE public.hostel_rooms IS 'Individual rooms within hostels';
COMMENT ON TABLE public.hostel_beds IS 'Individual beds within rooms';
COMMENT ON TABLE public.hostel_applications IS 'Student applications for hostel accommodation';
COMMENT ON TABLE public.hostel_waitlist IS 'Waitlist for hostel applications when no beds available';
COMMENT ON TABLE public.hostel_bed_allocations IS 'Actual bed assignments to students';
COMMENT ON TABLE public.hostel_maintenance_logs IS 'Maintenance requests and work orders';
COMMENT ON TABLE public.hostel_bed_history IS 'Audit trail of bed allocation changes';
COMMENT ON TABLE public.hostel_fee_payments IS 'Hostel-specific fee payments and receipts';

-- ============================================================================
-- TRIGGER FUNCTIONS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update bed status when allocation changes
CREATE OR REPLACE FUNCTION update_bed_status_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (new allocation)
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.hostel_beds SET status = 'occupied', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.bed_id;
    ELSIF NEW.status = 'pending_acceptance' THEN
      UPDATE public.hostel_beds SET status = 'reserved', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.bed_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (status change)
  IF TG_OP = 'UPDATE' THEN
    -- If allocation becomes active
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE public.hostel_beds SET status = 'occupied', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.bed_id;
    -- If allocation is cancelled or ended
    ELSIF OLD.status IN ('active','pending_acceptance') AND NEW.status IN ('cancelled','ended') THEN
      UPDATE public.hostel_beds SET status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.bed_id;
    -- If allocation becomes pending
    ELSIF OLD.status != 'pending_acceptance' AND NEW.status = 'pending_acceptance' THEN
      UPDATE public.hostel_beds SET status = 'reserved', updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.bed_id;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (allocation removed)
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('active','pending_acceptance') THEN
      UPDATE public.hostel_beds SET status = 'available', updated_at = CURRENT_TIMESTAMP
      WHERE id = OLD.bed_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bed status updates
CREATE TRIGGER trigger_update_bed_status_on_allocation
  AFTER INSERT OR UPDATE OR DELETE ON public.hostel_bed_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_bed_status_on_allocation();

-- Function to log bed history on allocation changes
CREATE OR REPLACE FUNCTION log_bed_history_on_allocation()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (new allocation)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hostel_bed_history (
      tenant_id, bed_id, student_id, allocation_id, action, start_date, 
      notes, performed_by, created_at
    ) VALUES (
      NEW.tenant_id, NEW.bed_id, NEW.student_id, NEW.id, 'assigned', 
      NEW.start_date, 'Bed allocated to student', NEW.created_by, CURRENT_TIMESTAMP
    );
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (status change)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO public.hostel_bed_history (
        tenant_id, bed_id, student_id, allocation_id, action, start_date,
        notes, performed_by, created_at
      ) VALUES (
        NEW.tenant_id, NEW.bed_id, NEW.student_id, NEW.id, 
        CASE 
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
          WHEN NEW.status = 'ended' THEN 'ended'
          WHEN NEW.status = 'active' THEN 'assigned'
          ELSE 'transferred'
        END,
        CURRENT_DATE, 
        'Status changed from ' || OLD.status || ' to ' || NEW.status,
        NEW.created_by, CURRENT_TIMESTAMP
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bed history logging
CREATE TRIGGER trigger_log_bed_history_on_allocation
  AFTER INSERT OR UPDATE ON public.hostel_bed_allocations
  FOR EACH ROW
  EXECUTE FUNCTION log_bed_history_on_allocation();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================