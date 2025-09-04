-- Add Sample Teachers for Testing
-- Run this AFTER running the diagnostic queries to add sample teachers

-- First, find your user's tenant_id (replace with your actual user email)
DO $$
DECLARE
  user_tenant_id UUID;
  user_email TEXT := 'kenedyokumu@gmail.com'; -- CHANGE THIS TO YOUR EMAIL
BEGIN
  -- Get the tenant_id for your user
  SELECT tenant_id INTO user_tenant_id 
  FROM users 
  WHERE email = user_email;
  
  IF user_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenant found for user: %', user_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found tenant_id: % for user: %', user_tenant_id, user_email;
  
  -- Check if teachers already exist for this tenant
  IF EXISTS (SELECT 1 FROM teachers WHERE tenant_id = user_tenant_id) THEN
    RAISE NOTICE 'Teachers already exist for this tenant';
    RETURN;
  END IF;
  
  -- Insert sample teachers
  INSERT INTO teachers (
    name, 
    phone, 
    age, 
    address, 
    qualification, 
    salary_amount, 
    salary_type, 
    tenant_id, 
    is_class_teacher
  ) VALUES 
  (
    'John Smith', 
    '+1234567890', 
    35, 
    '123 Main Street, City', 
    'M.Ed Mathematics', 
    50000, 
    'monthly', 
    user_tenant_id, 
    true
  ),
  (
    'Mary Johnson', 
    '+1234567891', 
    42, 
    '456 Oak Avenue, City', 
    'Ph.D English Literature', 
    55000, 
    'monthly', 
    user_tenant_id, 
    true
  ),
  (
    'David Wilson', 
    '+1234567892', 
    28, 
    '789 Pine Street, City', 
    'B.Sc Physics, B.Ed', 
    45000, 
    'monthly', 
    user_tenant_id, 
    false
  ),
  (
    'Sarah Brown', 
    '+1234567893', 
    31, 
    '321 Elm Drive, City', 
    'M.A History', 
    48000, 
    'monthly', 
    user_tenant_id, 
    false
  );
  
  RAISE NOTICE 'Successfully added 4 sample teachers for tenant: %', user_tenant_id;
  
END $$;

-- Verify the teachers were added
SELECT 'NEW TEACHERS ADDED' as info, id, name, phone, tenant_id, created_at
FROM teachers 
WHERE tenant_id IN (
  SELECT tenant_id FROM users WHERE email = 'kenedyokumu@gmail.com' -- CHANGE THIS TO YOUR EMAIL
)
ORDER BY created_at DESC;
