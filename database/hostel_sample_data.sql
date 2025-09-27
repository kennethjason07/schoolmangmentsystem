-- ========================================
-- HOSTEL MANAGEMENT SYSTEM - SAMPLE DATA
-- ========================================
-- Sample data for testing the hostel management system
-- Run this AFTER running hostel_schema.sql
-- ========================================

BEGIN;

-- Get the default tenant ID (you might need to adjust this)
-- Replace 'Default School' with your actual tenant name if different
DO $$
DECLARE
    default_tenant_id UUID;
    sample_hostel_id_1 UUID := gen_random_uuid();
    sample_hostel_id_2 UUID := gen_random_uuid();
    sample_block_id_1 UUID := gen_random_uuid();
    sample_block_id_2 UUID := gen_random_uuid();
    sample_room_id_1 UUID := gen_random_uuid();
    sample_room_id_2 UUID := gen_random_uuid();
    sample_room_id_3 UUID := gen_random_uuid();
    sample_student_id UUID;
BEGIN
    -- Get default tenant ID
    SELECT id INTO default_tenant_id 
    FROM public.tenants 
    WHERE name = 'Default School' 
    LIMIT 1;

    -- If tenant not found, skip the sample data
    IF default_tenant_id IS NULL THEN
        RAISE NOTICE 'Default School tenant not found. Skipping sample data.';
        RAISE NOTICE 'Please replace "Default School" with your tenant name in this script.';
        RETURN;
    END IF;

    RAISE NOTICE 'Creating sample data for tenant: %', default_tenant_id;

    -- Insert sample hostels
    INSERT INTO public.hostels (id, tenant_id, name, description, type, capacity, occupied, status, amenities, contact_phone) VALUES
    (sample_hostel_id_1, default_tenant_id, 'Main Hostel Block', 'Primary residential facility for students', 'mixed', 120, 45, 'active', '["WiFi", "Mess Hall", "Recreation Room", "Study Hall", "Laundry"]'::jsonb, '9876543210'),
    (sample_hostel_id_2, default_tenant_id, 'Girls Hostel', 'Dedicated hostel for female students', 'girls', 80, 30, 'active', '["WiFi", "Mess Hall", "Common Room", "Laundry", "Security"]'::jsonb, '9876543211');

    -- Insert sample blocks
    INSERT INTO public.hostel_blocks (id, tenant_id, hostel_id, name, floor, type, capacity, occupied, status) VALUES
    (sample_block_id_1, default_tenant_id, sample_hostel_id_1, 'Block A', 1, 'mixed', 60, 25, 'active'),
    (sample_block_id_2, default_tenant_id, sample_hostel_id_1, 'Block B', 2, 'mixed', 60, 20, 'active');

    -- Insert sample rooms
    INSERT INTO public.hostel_rooms (id, tenant_id, hostel_id, block_id, room_number, room_type, capacity, occupied, floor, amenities, rent_per_bed, status) VALUES
    (sample_room_id_1, default_tenant_id, sample_hostel_id_1, sample_block_id_1, 'A101', 'double', 2, 2, 1, '["AC", "Attached Bathroom"]'::jsonb, 5000.00, 'occupied'),
    (sample_room_id_2, default_tenant_id, sample_hostel_id_1, sample_block_id_1, 'A102', 'double', 2, 1, 1, '["AC", "Attached Bathroom"]'::jsonb, 5000.00, 'available'),
    (sample_room_id_3, default_tenant_id, sample_hostel_id_1, sample_block_id_2, 'B201', 'triple', 3, 0, 2, '["AC", "Shared Bathroom"]'::jsonb, 4000.00, 'available');

    -- Insert sample beds
    INSERT INTO public.hostel_beds (tenant_id, hostel_id, block_id, room_id, bed_number, status, rent_amount, security_deposit) VALUES
    -- Room A101 - Fully occupied
    (default_tenant_id, sample_hostel_id_1, sample_block_id_1, sample_room_id_1, 'Bed 1', 'occupied', 5000.00, 10000.00),
    (default_tenant_id, sample_hostel_id_1, sample_block_id_1, sample_room_id_1, 'Bed 2', 'occupied', 5000.00, 10000.00),
    -- Room A102 - Partially occupied
    (default_tenant_id, sample_hostel_id_1, sample_block_id_1, sample_room_id_2, 'Bed 1', 'occupied', 5000.00, 10000.00),
    (default_tenant_id, sample_hostel_id_1, sample_block_id_1, sample_room_id_2, 'Bed 2', 'available', 5000.00, 10000.00),
    -- Room B201 - All available
    (default_tenant_id, sample_hostel_id_1, sample_block_id_2, sample_room_id_3, 'Bed 1', 'available', 4000.00, 8000.00),
    (default_tenant_id, sample_hostel_id_1, sample_block_id_2, sample_room_id_3, 'Bed 2', 'available', 4000.00, 8000.00),
    (default_tenant_id, sample_hostel_id_1, sample_block_id_2, sample_room_id_3, 'Bed 3', 'available', 4000.00, 8000.00);

    -- Try to get a sample student ID for applications
    SELECT id INTO sample_student_id 
    FROM public.students 
    WHERE tenant_id = default_tenant_id 
    LIMIT 1;

    -- Insert sample applications (only if we have students)
    IF sample_student_id IS NOT NULL THEN
        INSERT INTO public.hostel_applications (tenant_id, student_id, hostel_id, room_preference, status, parent_consent, documents_submitted, reason_for_application, emergency_contact_name, emergency_contact_phone, emergency_contact_relation) VALUES
        (default_tenant_id, sample_student_id, sample_hostel_id_1, 'double', 'pending', true, true, 'Student lives far from school and needs accommodation', 'Parent Name', '9876543200', 'Father');
        
        RAISE NOTICE 'Created sample application for student: %', sample_student_id;
    ELSE
        RAISE NOTICE 'No students found - skipping sample applications';
    END IF;

    -- Insert sample maintenance logs
    INSERT INTO public.hostel_maintenance_logs (tenant_id, hostel_id, block_id, room_id, issue_type, description, priority, status, reported_date, estimated_cost) VALUES
    (default_tenant_id, sample_hostel_id_1, sample_block_id_1, sample_room_id_1, 'Electrical', 'AC not working properly in room A101', 'high', 'reported', CURRENT_DATE, 2500.00),
    (default_tenant_id, sample_hostel_id_1, sample_block_id_2, sample_room_id_3, 'Plumbing', 'Bathroom tap needs repair', 'medium', 'assigned', CURRENT_DATE - INTERVAL '2 days', 500.00);

    RAISE NOTICE 'Sample hostel data created successfully!';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- 2 Hostels (Main Hostel Block, Girls Hostel)';
    RAISE NOTICE '- 2 Blocks (Block A, Block B)';
    RAISE NOTICE '- 3 Rooms (A101, A102, B201)';
    RAISE NOTICE '- 7 Beds (various statuses)';
    RAISE NOTICE '- 2 Maintenance logs';
    IF sample_student_id IS NOT NULL THEN
        RAISE NOTICE '- 1 Sample application';
    END IF;

END $$;

COMMIT;

-- Display summary of created data
SELECT 
    'Hostels' as entity_type,
    COUNT(*) as count 
FROM public.hostels
UNION ALL
SELECT 
    'Blocks' as entity_type,
    COUNT(*) as count 
FROM public.hostel_blocks
UNION ALL
SELECT 
    'Rooms' as entity_type,
    COUNT(*) as count 
FROM public.hostel_rooms
UNION ALL
SELECT 
    'Beds' as entity_type,
    COUNT(*) as count 
FROM public.hostel_beds
UNION ALL
SELECT 
    'Applications' as entity_type,
    COUNT(*) as count 
FROM public.hostel_applications
UNION ALL
SELECT 
    'Maintenance Issues' as entity_type,
    COUNT(*) as count 
FROM public.hostel_maintenance_logs;