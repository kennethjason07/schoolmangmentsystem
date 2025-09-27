-- ========================================
-- HOSTEL MANAGEMENT SYSTEM DATABASE SCHEMA
-- ========================================
-- Multi-tenant aware hostel system for school management
-- Created: 2025-09-27
-- 
-- This schema includes:
-- 1. Hostels (buildings)
-- 2. Blocks (sections within hostels) 
-- 3. Rooms (individual rooms)
-- 4. Beds (individual beds in rooms)
-- 5. Applications (student hostel applications)
-- 6. Allocations (bed assignments)
-- 7. Bed History (tracking bed changes)
-- 8. Waitlist (waiting students)
-- 9. Maintenance Logs
-- 10. Hostel Fees
-- ========================================

-- Enable Row Level Security
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM public;

-- ========================================
-- TABLE: hostels
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'mixed' CHECK (type IN ('boys', 'girls', 'mixed')),
    address TEXT,
    capacity INTEGER DEFAULT 0,
    occupied INTEGER DEFAULT 0,
    warden_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    amenities JSONB DEFAULT '[]'::jsonb, -- Store amenities as JSON array
    rules TEXT, -- Hostel specific rules
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- ========================================
-- TABLE: hostel_blocks
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- Block A, Block B, etc.
    floor INTEGER DEFAULT 1,
    type VARCHAR(20) DEFAULT 'mixed' CHECK (type IN ('boys', 'girls', 'mixed')),
    capacity INTEGER DEFAULT 0,
    occupied INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABLE: hostel_rooms
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    room_type VARCHAR(30) DEFAULT 'shared' CHECK (room_type IN ('single', 'double', 'triple', 'shared', 'dormitory')),
    capacity INTEGER DEFAULT 2, -- Number of beds in room
    occupied INTEGER DEFAULT 0,
    floor INTEGER DEFAULT 1,
    amenities JSONB DEFAULT '[]'::jsonb, -- AC, attached bathroom, etc.
    rent_per_bed DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, hostel_id, block_id, room_number)
);

-- ========================================
-- TABLE: hostel_beds
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_beds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    bed_number VARCHAR(10) NOT NULL, -- Bed 1, Bed 2, etc.
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    allocated_date DATE,
    rent_amount DECIMAL(10,2) DEFAULT 0.00,
    security_deposit DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, room_id, bed_number)
);

-- ========================================
-- TABLE: hostel_applications
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
    room_preference VARCHAR(30) DEFAULT 'any' CHECK (room_preference IN ('single', 'double', 'triple', 'shared', 'any')),
    application_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'allocated')),
    priority_score INTEGER DEFAULT 0, -- For waitlist ordering
    parent_consent BOOLEAN DEFAULT false,
    medical_certificate BOOLEAN DEFAULT false,
    documents_submitted BOOLEAN DEFAULT false,
    reason_for_application TEXT,
    special_requirements TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relation VARCHAR(50),
    remarks TEXT, -- Admin remarks
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABLE: hostel_allocations
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.hostel_applications(id) ON DELETE SET NULL,
    hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    bed_id UUID NOT NULL REFERENCES public.hostel_beds(id) ON DELETE CASCADE,
    allocation_date DATE DEFAULT CURRENT_DATE,
    checkout_date DATE, -- When student leaves
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'checked_out', 'transferred', 'suspended')),
    monthly_rent DECIMAL(10,2) DEFAULT 0.00,
    security_deposit_paid DECIMAL(10,2) DEFAULT 0.00,
    security_deposit_refunded DECIMAL(10,2) DEFAULT 0.00,
    allocated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    checkout_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tenant_id, student_id, status) -- One active allocation per student
);

-- ========================================
-- TABLE: hostel_bed_history
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_bed_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    allocation_id UUID NOT NULL REFERENCES public.hostel_allocations(id) ON DELETE CASCADE,
    from_bed_id UUID REFERENCES public.hostel_beds(id) ON DELETE SET NULL,
    to_bed_id UUID REFERENCES public.hostel_beds(id) ON DELETE SET NULL,
    change_date DATE DEFAULT CURRENT_DATE,
    change_reason TEXT,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABLE: hostel_waitlist
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES public.hostel_applications(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
    position INTEGER DEFAULT 1, -- Position in waitlist
    added_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'allocated', 'expired')),
    notification_sent_date DATE,
    response_deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABLE: hostel_maintenance_logs
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_maintenance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    hostel_id UUID REFERENCES public.hostels(id) ON DELETE CASCADE,
    block_id UUID REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
    room_id UUID REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
    bed_id UUID REFERENCES public.hostel_beds(id) ON DELETE CASCADE,
    issue_type VARCHAR(50), -- electrical, plumbing, furniture, etc.
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'reported' CHECK (status IN ('reported', 'assigned', 'in_progress', 'resolved', 'cancelled')),
    reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_to VARCHAR(100), -- Maintenance person name
    reported_date DATE DEFAULT CURRENT_DATE,
    resolved_date DATE,
    estimated_cost DECIMAL(10,2) DEFAULT 0.00,
    actual_cost DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- TABLE: hostel_fees
-- ========================================
CREATE TABLE IF NOT EXISTS public.hostel_fees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    allocation_id UUID NOT NULL REFERENCES public.hostel_allocations(id) ON DELETE CASCADE,
    fee_type VARCHAR(30) DEFAULT 'monthly_rent' CHECK (fee_type IN ('monthly_rent', 'security_deposit', 'mess_fee', 'maintenance_fee', 'other')),
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'waived')),
    payment_method VARCHAR(30),
    transaction_id VARCHAR(100),
    late_fee DECIMAL(10,2) DEFAULT 0.00,
    discount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES
-- ========================================
-- Hostels
CREATE INDEX IF NOT EXISTS idx_hostels_tenant_id ON public.hostels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostels_warden_id ON public.hostels(warden_id);
CREATE INDEX IF NOT EXISTS idx_hostels_status ON public.hostels(status);

-- Hostel Blocks
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_tenant_id ON public.hostel_blocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_hostel_id ON public.hostel_blocks(hostel_id);

-- Hostel Rooms
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_tenant_id ON public.hostel_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_hostel_id ON public.hostel_rooms(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_block_id ON public.hostel_rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_status ON public.hostel_rooms(status);

-- Hostel Beds
CREATE INDEX IF NOT EXISTS idx_hostel_beds_tenant_id ON public.hostel_beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_room_id ON public.hostel_beds(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_student_id ON public.hostel_beds(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_status ON public.hostel_beds(status);

-- Applications
CREATE INDEX IF NOT EXISTS idx_hostel_applications_tenant_id ON public.hostel_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_student_id ON public.hostel_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_status ON public.hostel_applications(status);
CREATE INDEX IF NOT EXISTS idx_hostel_applications_date ON public.hostel_applications(application_date);

-- Allocations
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_tenant_id ON public.hostel_allocations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_student_id ON public.hostel_allocations(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_bed_id ON public.hostel_allocations(bed_id);
CREATE INDEX IF NOT EXISTS idx_hostel_allocations_status ON public.hostel_allocations(status);

-- ========================================
-- ROW LEVEL SECURITY POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_bed_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_fees ENABLE ROW LEVEL SECURITY;

-- Hostels policies
DROP POLICY IF EXISTS "Users can only access hostels from their tenant" ON public.hostels;
CREATE POLICY "Users can only access hostels from their tenant" ON public.hostels
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Hostel Blocks policies
DROP POLICY IF EXISTS "Users can only access hostel blocks from their tenant" ON public.hostel_blocks;
CREATE POLICY "Users can only access hostel blocks from their tenant" ON public.hostel_blocks
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Hostel Rooms policies
DROP POLICY IF EXISTS "Users can only access hostel rooms from their tenant" ON public.hostel_rooms;
CREATE POLICY "Users can only access hostel rooms from their tenant" ON public.hostel_rooms
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Hostel Beds policies
DROP POLICY IF EXISTS "Users can only access hostel beds from their tenant" ON public.hostel_beds;
CREATE POLICY "Users can only access hostel beds from their tenant" ON public.hostel_beds
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Applications policies
DROP POLICY IF EXISTS "Users can only access hostel applications from their tenant" ON public.hostel_applications;
CREATE POLICY "Users can only access hostel applications from their tenant" ON public.hostel_applications
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Allocations policies
DROP POLICY IF EXISTS "Users can only access hostel allocations from their tenant" ON public.hostel_allocations;
CREATE POLICY "Users can only access hostel allocations from their tenant" ON public.hostel_allocations
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Bed History policies
DROP POLICY IF EXISTS "Users can only access hostel bed history from their tenant" ON public.hostel_bed_history;
CREATE POLICY "Users can only access hostel bed history from their tenant" ON public.hostel_bed_history
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Waitlist policies
DROP POLICY IF EXISTS "Users can only access hostel waitlist from their tenant" ON public.hostel_waitlist;
CREATE POLICY "Users can only access hostel waitlist from their tenant" ON public.hostel_waitlist
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Maintenance Logs policies
DROP POLICY IF EXISTS "Users can only access hostel maintenance logs from their tenant" ON public.hostel_maintenance_logs;
CREATE POLICY "Users can only access hostel maintenance logs from their tenant" ON public.hostel_maintenance_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Hostel Fees policies
DROP POLICY IF EXISTS "Users can only access hostel fees from their tenant" ON public.hostel_fees;
CREATE POLICY "Users can only access hostel fees from their tenant" ON public.hostel_fees
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ========================================
-- VIEWS FOR REPORTING
-- ========================================

-- View for hostel occupancy report
CREATE OR REPLACE VIEW public.v_hostel_occupancy AS
SELECT 
    h.id as hostel_id,
    h.tenant_id,
    h.name as hostel_name,
    h.capacity as total_capacity,
    h.occupied as current_occupied,
    (h.capacity - h.occupied) as available_beds,
    CASE 
        WHEN h.capacity > 0 THEN ROUND((h.occupied::decimal / h.capacity::decimal) * 100, 2)
        ELSE 0 
    END as occupancy_percentage,
    COUNT(hr.id) as total_rooms,
    COUNT(CASE WHEN hr.status = 'available' THEN 1 END) as available_rooms,
    COUNT(CASE WHEN hr.status = 'occupied' THEN 1 END) as occupied_rooms,
    COUNT(CASE WHEN hr.status = 'maintenance' THEN 1 END) as maintenance_rooms
FROM public.hostels h
LEFT JOIN public.hostel_rooms hr ON h.id = hr.hostel_id
WHERE h.tenant_id = current_setting('app.current_tenant_id')::uuid
GROUP BY h.id, h.name, h.capacity, h.occupied;

-- View for bed allocation summary
CREATE OR REPLACE VIEW public.v_bed_allocation_summary AS
SELECT 
    h.id as hostel_id,
    h.tenant_id,
    h.name as hostel_name,
    hb.id as block_id,
    hb.name as block_name,
    hr.id as room_id,
    hr.room_number,
    hr.room_type,
    hr.capacity as room_capacity,
    hr.occupied as room_occupied,
    bed.id as bed_id,
    bed.bed_number,
    bed.status as bed_status,
    s.id as student_id,
    s.admission_no,
    s.first_name || ' ' || s.last_name as student_name,
    ha.allocation_date,
    bed.rent_amount
FROM public.hostels h
LEFT JOIN public.hostel_blocks hb ON h.id = hb.hostel_id
LEFT JOIN public.hostel_rooms hr ON hb.id = hr.block_id
LEFT JOIN public.hostel_beds bed ON hr.id = bed.room_id
LEFT JOIN public.students s ON bed.student_id = s.id
LEFT JOIN public.hostel_allocations ha ON ha.bed_id = bed.id AND ha.student_id = s.id AND ha.status = 'active'
WHERE h.tenant_id = current_setting('app.current_tenant_id')::uuid
ORDER BY h.name, hb.name, hr.room_number, bed.bed_number;

-- ========================================
-- FUNCTIONS
-- ========================================

-- Function to update hostel occupancy counts
CREATE OR REPLACE FUNCTION update_hostel_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update hostel occupied count
    IF TG_OP = 'INSERT' AND NEW.status = 'occupied' THEN
        UPDATE public.hostels 
        SET occupied = occupied + 1, updated_at = NOW()
        WHERE id = NEW.hostel_id;
        
        -- Update room occupied count
        UPDATE public.hostel_rooms 
        SET occupied = occupied + 1, updated_at = NOW()
        WHERE id = NEW.room_id;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Bed became occupied
        IF OLD.status != 'occupied' AND NEW.status = 'occupied' THEN
            UPDATE public.hostels 
            SET occupied = occupied + 1, updated_at = NOW()
            WHERE id = NEW.hostel_id;
            
            UPDATE public.hostel_rooms 
            SET occupied = occupied + 1, updated_at = NOW()
            WHERE id = NEW.room_id;
            
        -- Bed became available  
        ELSIF OLD.status = 'occupied' AND NEW.status != 'occupied' THEN
            UPDATE public.hostels 
            SET occupied = GREATEST(0, occupied - 1), updated_at = NOW()
            WHERE id = NEW.hostel_id;
            
            UPDATE public.hostel_rooms 
            SET occupied = GREATEST(0, occupied - 1), updated_at = NOW()
            WHERE id = NEW.room_id;
        END IF;
        
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'occupied' THEN
        UPDATE public.hostels 
        SET occupied = GREATEST(0, occupied - 1), updated_at = NOW()
        WHERE id = OLD.hostel_id;
        
        UPDATE public.hostel_rooms 
        SET occupied = GREATEST(0, occupied - 1), updated_at = NOW()
        WHERE id = OLD.room_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_occupancy ON public.hostel_beds;
CREATE TRIGGER trigger_update_occupancy
    AFTER INSERT OR UPDATE OR DELETE ON public.hostel_beds
    FOR EACH ROW EXECUTE FUNCTION update_hostel_occupancy();

-- ========================================
-- ADD WARDEN ROLE
-- ========================================

-- Add warden role to all tenants if it doesn't exist
INSERT INTO public.roles (id, role_name, tenant_id, created_at, updated_at)
SELECT 5, 'Warden', t.id, NOW(), NOW()
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles r 
    WHERE r.role_name = 'Warden' AND r.tenant_id = t.id
);

-- ========================================
-- SAMPLE DATA (OPTIONAL)
-- ========================================
-- Uncomment the following to insert sample data

/*
-- Sample hostel data for default tenant
INSERT INTO public.hostels (tenant_id, name, description, type, capacity, warden_id, status, amenities, contact_phone)
VALUES 
((SELECT id FROM public.tenants WHERE name = 'Default School' LIMIT 1), 
 'Main Hostel', 'Primary hostel building', 'mixed', 100, NULL, 'active', 
 '["WiFi", "Mess", "Recreation Room", "Study Hall"]'::jsonb, '1234567890'),
 
((SELECT id FROM public.tenants WHERE name = 'Default School' LIMIT 1), 
 'Girls Hostel', 'Dedicated girls hostel', 'girls', 80, NULL, 'active', 
 '["WiFi", "Mess", "Common Room", "Laundry"]'::jsonb, '1234567891');
*/

COMMIT;