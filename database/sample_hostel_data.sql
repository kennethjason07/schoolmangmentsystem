-- Sample Data for Hostel Management System
-- Run this after creating the schema and adding warden roles

-- Note: Replace the tenant_id values with your actual tenant IDs
-- You can find your tenant IDs by running: SELECT id, name FROM public.tenants;

-- Variables (replace with your actual tenant ID)
-- For this example, we'll use a placeholder. Replace 'your-tenant-id-here' with actual UUID

DO $$
DECLARE
    sample_tenant_id UUID;
    sample_student_id_1 UUID;
    sample_student_id_2 UUID;
    sample_student_id_3 UUID;
    sample_warden_user_id UUID;
    sample_hostel_id UUID;
    sample_block_id UUID;
    sample_room_id_1 UUID;
    sample_room_id_2 UUID;
    sample_bed_id_1 UUID;
    sample_bed_id_2 UUID;
    sample_bed_id_3 UUID;
    sample_bed_id_4 UUID;
BEGIN
    -- Get a sample tenant ID (you should replace this with your actual tenant ID)
    SELECT id INTO sample_tenant_id FROM public.tenants LIMIT 1;
    
    IF sample_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found. Please ensure you have at least one tenant in the tenants table.';
    END IF;
    
    RAISE NOTICE 'Using tenant ID: %', sample_tenant_id;
    
    -- Create sample warden user if not exists
    INSERT INTO public.users (email, role_id, full_name, phone, tenant_id)
    VALUES ('warden@example.com', 5, 'John Doe (Warden)', '9876543210', sample_tenant_id)
    ON CONFLICT (email) DO UPDATE SET
        role_id = 5,
        full_name = 'John Doe (Warden)',
        phone = '9876543210'
    RETURNING id INTO sample_warden_user_id;
    
    -- Create sample students if they don't exist
    INSERT INTO public.students (student_number, name, email, phone, department, gender, dob, tenant_id)
    VALUES 
        ('ST001', 'Alice Johnson', 'alice@example.com', '9876543211', 'Computer Science', 'Female', '2002-05-15', sample_tenant_id),
        ('ST002', 'Bob Smith', 'bob@example.com', '9876543212', 'Electrical Engineering', 'Male', '2001-08-22', sample_tenant_id),
        ('ST003', 'Carol Davis', 'carol@example.com', '9876543213', 'Mechanical Engineering', 'Female', '2002-01-10', sample_tenant_id)
    ON CONFLICT (student_number) DO NOTHING
    RETURNING id INTO sample_student_id_1;
    
    -- Get student IDs if they already existed
    IF sample_student_id_1 IS NULL THEN
        SELECT id INTO sample_student_id_1 FROM public.students WHERE student_number = 'ST001' AND tenant_id = sample_tenant_id;
        SELECT id INTO sample_student_id_2 FROM public.students WHERE student_number = 'ST002' AND tenant_id = sample_tenant_id;
        SELECT id INTO sample_student_id_3 FROM public.students WHERE student_number = 'ST003' AND tenant_id = sample_tenant_id;
    ELSE
        -- Get the other student IDs
        SELECT id INTO sample_student_id_2 FROM public.students WHERE student_number = 'ST002' AND tenant_id = sample_tenant_id;
        SELECT id INTO sample_student_id_3 FROM public.students WHERE student_number = 'ST003' AND tenant_id = sample_tenant_id;
    END IF;
    
    -- Create sample hostel
    INSERT INTO public.hostels (name, address, contact_phone, hostel_type, capacity, warden_id, description, amenities, tenant_id)
    VALUES (
        'Green Valley Hostel',
        '123 University Avenue, Campus Road',
        '+91-9876543210',
        'mixed',
        200,
        sample_warden_user_id,
        'A modern hostel facility with all basic amenities',
        ARRAY['WiFi', 'Laundry', 'Common Room', 'Mess', 'Security', 'Parking'],
        sample_tenant_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sample_hostel_id;
    
    -- Get hostel ID if it already existed
    IF sample_hostel_id IS NULL THEN
        SELECT id INTO sample_hostel_id FROM public.hostels WHERE name = 'Green Valley Hostel' AND tenant_id = sample_tenant_id;
    END IF;
    
    -- Create sample block
    INSERT INTO public.blocks (hostel_id, name, description, total_floors, tenant_id)
    VALUES (
        sample_hostel_id,
        'Block A',
        'Main residential block with modern facilities',
        3,
        sample_tenant_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO sample_block_id;
    
    -- Get block ID if it already existed
    IF sample_block_id IS NULL THEN
        SELECT id INTO sample_block_id FROM public.blocks WHERE name = 'Block A' AND hostel_id = sample_hostel_id;
    END IF;
    
    -- Create sample rooms
    INSERT INTO public.rooms (hostel_id, block_id, floor, room_number, capacity, room_type, amenities, monthly_fee, tenant_id)
    VALUES 
        (sample_hostel_id, sample_block_id, 1, 'A101', 2, 'standard', ARRAY['Bed', 'Study Table', 'Cupboard', 'Fan'], 5000.00, sample_tenant_id),
        (sample_hostel_id, sample_block_id, 1, 'A102', 2, 'standard', ARRAY['Bed', 'Study Table', 'Cupboard', 'Fan', 'AC'], 7000.00, sample_tenant_id)
    ON CONFLICT (hostel_id, room_number) DO NOTHING
    RETURNING id INTO sample_room_id_1;
    
    -- Get room IDs if they already existed
    IF sample_room_id_1 IS NULL THEN
        SELECT id INTO sample_room_id_1 FROM public.rooms WHERE room_number = 'A101' AND hostel_id = sample_hostel_id;
        SELECT id INTO sample_room_id_2 FROM public.rooms WHERE room_number = 'A102' AND hostel_id = sample_hostel_id;
    ELSE
        SELECT id INTO sample_room_id_2 FROM public.rooms WHERE room_number = 'A102' AND hostel_id = sample_hostel_id;
    END IF;
    
    -- Create sample beds
    INSERT INTO public.beds (room_id, bed_label, bed_type, status, tenant_id)
    VALUES 
        (sample_room_id_1, 'A', 'lower', 'occupied', sample_tenant_id),
        (sample_room_id_1, 'B', 'upper', 'available', sample_tenant_id),
        (sample_room_id_2, '1', 'normal', 'available', sample_tenant_id),
        (sample_room_id_2, '2', 'normal', 'maintenance', sample_tenant_id)
    ON CONFLICT (room_id, bed_label) DO NOTHING;
    
    -- Get bed IDs
    SELECT id INTO sample_bed_id_1 FROM public.beds WHERE room_id = sample_room_id_1 AND bed_label = 'A';
    SELECT id INTO sample_bed_id_2 FROM public.beds WHERE room_id = sample_room_id_1 AND bed_label = 'B';
    SELECT id INTO sample_bed_id_3 FROM public.beds WHERE room_id = sample_room_id_2 AND bed_label = '1';
    SELECT id INTO sample_bed_id_4 FROM public.beds WHERE room_id = sample_room_id_2 AND bed_label = '2';
    
    -- Create sample hostel applications
    INSERT INTO public.hostel_applications (
        student_id, hostel_id, academic_year, preferred_room_type, 
        special_requirements, documents, status, tenant_id
    )
    VALUES 
        (
            sample_student_id_1, sample_hostel_id, '2024', 'standard',
            'Need ground floor room due to mobility issues',
            '[{"name": "ID Proof", "url": "/documents/id_proof_alice.pdf"}, {"name": "Medical Certificate", "url": "/documents/medical_alice.pdf"}]'::jsonb,
            'submitted',
            sample_tenant_id
        ),
        (
            sample_student_id_2, sample_hostel_id, '2024', 'standard',
            NULL,
            '[{"name": "ID Proof", "url": "/documents/id_proof_bob.pdf"}]'::jsonb,
            'verified',
            sample_tenant_id
        ),
        (
            sample_student_id_3, sample_hostel_id, '2024', 'deluxe',
            'Prefer single occupancy room',
            '[{"name": "ID Proof", "url": "/documents/id_proof_carol.pdf"}]'::jsonb,
            'accepted',
            sample_tenant_id
        )
    ON CONFLICT (student_id, academic_year, hostel_id) DO NOTHING;
    
    -- Create a sample bed allocation for the accepted student
    INSERT INTO public.bed_allocations (
        application_id,
        student_id,
        bed_id,
        academic_year,
        start_date,
        status,
        acceptance_deadline,
        created_by,
        tenant_id
    )
    SELECT 
        ha.id,
        sample_student_id_1,
        sample_bed_id_1,
        '2024',
        CURRENT_DATE,
        'active',
        CURRENT_DATE + INTERVAL '7 days',
        sample_warden_user_id,
        sample_tenant_id
    FROM public.hostel_applications ha
    WHERE ha.student_id = sample_student_id_1 
      AND ha.hostel_id = sample_hostel_id
      AND ha.academic_year = '2024'
    ON CONFLICT DO NOTHING;
    
    -- Create bed history entry
    INSERT INTO public.bed_history (
        bed_id,
        student_id,
        start_date,
        action,
        notes,
        performed_by,
        tenant_id
    )
    VALUES (
        sample_bed_id_1,
        sample_student_id_1,
        CURRENT_DATE,
        'assigned',
        'Initial allocation for academic year 2024',
        sample_warden_user_id,
        sample_tenant_id
    )
    ON CONFLICT DO NOTHING;
    
    -- Create sample waitlist entry
    INSERT INTO public.hostel_waitlist (
        application_id,
        hostel_id,
        priority_score,
        tenant_id
    )
    SELECT 
        ha.id,
        sample_hostel_id,
        500, -- Higher priority (lower score)
        sample_tenant_id
    FROM public.hostel_applications ha
    WHERE ha.student_id = sample_student_id_2 
      AND ha.hostel_id = sample_hostel_id
      AND ha.status = 'verified'
    ON CONFLICT DO NOTHING;
    
    -- Create sample maintenance log
    INSERT INTO public.hostel_maintenance_logs (
        hostel_id,
        room_id,
        bed_id,
        issue_type,
        issue_description,
        priority,
        reported_by,
        status,
        tenant_id
    )
    VALUES (
        sample_hostel_id,
        sample_room_id_2,
        sample_bed_id_4,
        'furniture',
        'Bed frame is broken and needs replacement',
        'medium',
        sample_warden_user_id,
        'reported',
        sample_tenant_id
    );
    
    -- Create sample hostel fees
    INSERT INTO public.hostel_fees (
        student_id,
        allocation_id,
        academic_year,
        fee_type,
        amount,
        due_date,
        payment_status,
        tenant_id
    )
    SELECT 
        ba.student_id,
        ba.id,
        ba.academic_year,
        'monthly_rent',
        5000.00,
        CURRENT_DATE + INTERVAL '30 days',
        'pending',
        sample_tenant_id
    FROM public.bed_allocations ba
    WHERE ba.student_id = sample_student_id_1;
    
    RAISE NOTICE 'Sample hostel data created successfully!';
    RAISE NOTICE 'Warden User ID: %', sample_warden_user_id;
    RAISE NOTICE 'Hostel ID: %', sample_hostel_id;
    RAISE NOTICE 'You can now login with email: warden@example.com';
    
END $$;

-- Verify the data creation
SELECT 'Hostels created' as item, count(*) as count FROM public.hostels
UNION ALL
SELECT 'Blocks created', count(*) FROM public.blocks
UNION ALL
SELECT 'Rooms created', count(*) FROM public.rooms  
UNION ALL
SELECT 'Beds created', count(*) FROM public.beds
UNION ALL
SELECT 'Applications created', count(*) FROM public.hostel_applications
UNION ALL
SELECT 'Allocations created', count(*) FROM public.bed_allocations
UNION ALL
SELECT 'Waitlist entries', count(*) FROM public.hostel_waitlist
UNION ALL
SELECT 'Maintenance logs', count(*) FROM public.hostel_maintenance_logs
UNION ALL
SELECT 'Hostel fees', count(*) FROM public.hostel_fees;

-- Show sample data summary
SELECT 
    h.name as hostel_name,
    COUNT(DISTINCT b.id) as blocks,
    COUNT(DISTINCT r.id) as rooms,
    COUNT(DISTINCT beds.id) as total_beds,
    COUNT(DISTINCT CASE WHEN beds.status = 'occupied' THEN beds.id END) as occupied_beds,
    COUNT(DISTINCT CASE WHEN beds.status = 'available' THEN beds.id END) as available_beds,
    COUNT(DISTINCT ha.id) as applications,
    COUNT(DISTINCT ba.id) as allocations
FROM public.hostels h
LEFT JOIN public.blocks b ON h.id = b.hostel_id
LEFT JOIN public.rooms r ON h.id = r.hostel_id  
LEFT JOIN public.beds beds ON r.id = beds.room_id
LEFT JOIN public.hostel_applications ha ON h.id = ha.hostel_id
LEFT JOIN public.bed_allocations ba ON h.id = ba.bed_id
GROUP BY h.id, h.name;