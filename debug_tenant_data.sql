-- Debug script to investigate tenant data issues
-- Run this to understand what's happening with tenant_id values

-- 1. Check current tenant information
SELECT 
  id as tenant_id,
  name as tenant_name,
  status,
  created_at
FROM tenants 
ORDER BY created_at;

-- 2. Check users and their tenant assignments
SELECT 
  u.id as user_id,
  u.email,
  u.full_name,
  u.tenant_id,
  t.name as tenant_name,
  t.status as tenant_status
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
ORDER BY u.email;

-- 3. Check exams table for tenant_id issues
SELECT 
  e.id as exam_id,
  e.name as exam_name,
  e.tenant_id as exam_tenant_id,
  t.name as tenant_name,
  COUNT(*) as exam_count
FROM exams e
LEFT JOIN tenants t ON e.tenant_id = t.id
GROUP BY e.tenant_id, t.name, e.id, e.name
ORDER BY e.tenant_id;

-- 4. Check for exams with NULL or invalid tenant_id
SELECT 
  id as exam_id,
  name as exam_name,
  tenant_id,
  created_at
FROM exams 
WHERE tenant_id IS NULL 
   OR tenant_id NOT IN (SELECT id FROM tenants WHERE status = 'active');

-- 5. Check classes table for tenant_id issues
SELECT 
  c.tenant_id,
  t.name as tenant_name,
  COUNT(*) as class_count
FROM classes c
LEFT JOIN tenants t ON c.tenant_id = t.id
GROUP BY c.tenant_id, t.name
ORDER BY c.tenant_id;

-- 6. Check students table for tenant_id issues  
SELECT 
  s.tenant_id,
  t.name as tenant_name,
  COUNT(*) as student_count
FROM students s
LEFT JOIN tenants t ON s.tenant_id = t.id
GROUP BY s.tenant_id, t.name
ORDER BY s.tenant_id;

-- 7. Check marks table for tenant_id issues
SELECT 
  m.tenant_id,
  t.name as tenant_name,
  COUNT(*) as marks_count
FROM marks m
LEFT JOIN tenants t ON m.tenant_id = t.id
GROUP BY m.tenant_id, t.name
ORDER BY m.tenant_id;

-- 8. Find records with mismatched tenant_ids
-- This will show if there are any records that should belong to one tenant but are assigned to another
SELECT 
  'exams' as table_name,
  e.id as record_id,
  e.name as record_name,
  e.tenant_id as current_tenant_id,
  t.name as current_tenant_name
FROM exams e
LEFT JOIN tenants t ON e.tenant_id = t.id
WHERE e.tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000' -- Replace with your expected tenant_id

UNION ALL

SELECT 
  'classes' as table_name,
  c.id as record_id,
  c.class_name as record_name,
  c.tenant_id as current_tenant_id,
  t.name as current_tenant_name
FROM classes c
LEFT JOIN tenants t ON c.tenant_id = t.id
WHERE c.tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000' -- Replace with your expected tenant_id

UNION ALL

SELECT 
  'students' as table_name,
  s.id as record_id,
  s.name as record_name,
  s.tenant_id as current_tenant_id,
  t.name as current_tenant_name
FROM students s
LEFT JOIN tenants t ON s.tenant_id = t.id
WHERE s.tenant_id != 'b8f8b5f0-1234-4567-8901-123456789000' -- Replace with your expected tenant_id
ORDER BY table_name, record_id;
