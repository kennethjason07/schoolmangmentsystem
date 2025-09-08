-- FIX USER TENANT ASSIGNMENT
-- After running find_correct_tenant.sql, use this to fix the assignment

-- OPTION 1: If you want to reassign user to tenant with most data
-- First, find the tenant with the most data (uncomment to use)
/*
UPDATE users 
SET tenant_id = (
    WITH tenant_data AS (
        SELECT 
            t.id,
            (COALESCE(item_count.cnt, 0) + COALESCE(purchase_count.cnt, 0) + COALESCE(student_count.cnt, 0)) as total_data
        FROM tenants t
        LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM stationary_items GROUP BY tenant_id) item_count ON t.id = item_count.tenant_id
        LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM stationary_purchases GROUP BY tenant_id) purchase_count ON t.id = purchase_count.tenant_id
        LEFT JOIN (SELECT tenant_id, COUNT(*) as cnt FROM students GROUP BY tenant_id) student_count ON t.id = student_count.tenant_id
        WHERE t.status = 'active'
    )
    SELECT id FROM tenant_data ORDER BY total_data DESC LIMIT 1
)
WHERE email = 'prakash01033@gmail.com';
*/

-- OPTION 2: If you want to move all your data to the Default School tenant
-- Move all stationary items to Default School
UPDATE stationary_items 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000';

-- Move all stationary purchases to Default School
UPDATE stationary_purchases 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000';

-- Move all students to Default School
UPDATE students 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000';

-- Move all classes to Default School
UPDATE classes 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000';

-- Move all teachers to Default School
UPDATE teachers 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000';

-- Move all users to Default School
UPDATE users 
SET tenant_id = 'b8f8b5f0-1234-4567-8901-123456789000'
WHERE tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000' OR tenant_id IS NULL;

-- OPTION 3: Manual assignment to specific tenant (replace CORRECT_TENANT_ID)
-- UPDATE users 
-- SET tenant_id = 'CORRECT_TENANT_ID'
-- WHERE email = 'prakash01033@gmail.com';

-- Verify the fix
SELECT 'VERIFICATION' as info;
SELECT 
    u.email,
    u.tenant_id as user_tenant_id,
    t.name as tenant_name,
    t.subdomain
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.email = 'prakash01033@gmail.com';

-- Show data counts after fix
SELECT 'DATA AFTER FIX' as info;
SELECT 
    t.name as tenant_name,
    COALESCE(si.items, 0) as stationary_items,
    COALESCE(sp.purchases, 0) as stationary_purchases,
    COALESCE(s.students, 0) as students,
    COALESCE(c.classes, 0) as classes
FROM tenants t
LEFT JOIN (SELECT tenant_id, COUNT(*) as items FROM stationary_items GROUP BY tenant_id) si ON t.id = si.tenant_id
LEFT JOIN (SELECT tenant_id, COUNT(*) as purchases FROM stationary_purchases GROUP BY tenant_id) sp ON t.id = sp.tenant_id
LEFT JOIN (SELECT tenant_id, COUNT(*) as students FROM students GROUP BY tenant_id) s ON t.id = s.tenant_id
LEFT JOIN (SELECT tenant_id, COUNT(*) as classes FROM classes GROUP BY tenant_id) c ON t.id = c.tenant_id
WHERE t.status = 'active'
ORDER BY t.name;
