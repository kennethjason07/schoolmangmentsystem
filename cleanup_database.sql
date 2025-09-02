-- Database cleanup script to fix undefined/invalid role_id values
-- Run this in your Supabase SQL editor

-- 1. First, let's see what users have problematic role_id values
SELECT 
  id, 
  email, 
  full_name, 
  role_id, 
  created_at
FROM users 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10
   OR NOT (role_id::text ~ '^[0-9]+$')  -- Check if role_id is not a valid integer
ORDER BY created_at DESC;

-- 2. Count how many problematic records exist
SELECT 
  COUNT(*) as problematic_users,
  COUNT(CASE WHEN role_id IS NULL THEN 1 END) as null_role_id,
  COUNT(CASE WHEN role_id < 1 THEN 1 END) as negative_role_id,
  COUNT(CASE WHEN role_id > 10 THEN 1 END) as out_of_range_role_id
FROM users 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10;

-- 3. Fix all problematic role_id values by setting them to 1 (admin)
UPDATE users 
SET role_id = 1 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10;

-- 4. Verify the fix worked
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN role_id = 1 THEN 1 END) as admin_users,
  COUNT(CASE WHEN role_id = 2 THEN 1 END) as teacher_users,
  COUNT(CASE WHEN role_id = 3 THEN 1 END) as parent_users,
  COUNT(CASE WHEN role_id = 4 THEN 1 END) as student_users,
  COUNT(CASE WHEN role_id IS NULL OR role_id < 1 OR role_id > 10 THEN 1 END) as remaining_problematic
FROM users;

-- 5. Optional: Create a constraint to prevent future invalid role_id values
-- (Uncomment the line below if you want to add this constraint)
-- ALTER TABLE users ADD CONSTRAINT valid_role_id CHECK (role_id >= 1 AND role_id <= 10);
