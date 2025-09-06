-- VERIFY TENANT_ID STATUS IN DATABASE

-- Check students table tenant_id status
SELECT 'STUDENTS TENANT_ID STATUS:' as info;
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as students_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as students_with_tenant
FROM students;

-- Show sample students with tenant_id
SELECT 'SAMPLE STUDENTS WITH TENANT_ID:' as info;
SELECT 
    id, 
    name, 
    tenant_id, 
    class_id,
    created_at
FROM students 
WHERE tenant_id IS NOT NULL
LIMIT 5;

-- Check users table tenant_id status
SELECT 'USERS TENANT_ID STATUS:' as info;
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as users_without_tenant,
    COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as users_with_tenant
FROM users;

-- Check user-student relationship
SELECT 'USER-STUDENT RELATIONSHIP CHECK:' as info;
SELECT 
    u.id as user_id,
    u.email,
    u.tenant_id as user_tenant_id,
    s.id as student_id,
    s.name as student_name,
    s.tenant_id as student_tenant_id
FROM users u
JOIN students s ON u.linked_student_id = s.id
WHERE u.linked_student_id IS NOT NULL
LIMIT 3;

-- Check tenants table
SELECT 'AVAILABLE TENANTS:' as info;
SELECT id, name, status FROM tenants;

SELECT 'Database verification complete!' as status;
