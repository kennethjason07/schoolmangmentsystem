-- QUICK TEST: Verify tenant_id columns exist in stationary tables
-- Run this in your Supabase SQL Editor

-- Test 1: Check if tenant_id column exists in stationary_items table
SELECT 
    'stationary_items table structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'stationary_items' 
  AND column_name = 'tenant_id';

-- Test 2: Check if tenant_id column exists in stationary_purchases table
SELECT 
    'stationary_purchases table structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'stationary_purchases' 
  AND column_name = 'tenant_id';

-- Test 3: Check if tenant_id column exists in users table
SELECT 
    'users table structure' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'tenant_id';

-- Test 4: Check sample data in stationary_items with tenant_id
SELECT 
    'Sample stationary_items with tenant_id' as info,
    id,
    name,
    fee_amount,
    tenant_id,
    created_at
FROM stationary_items 
LIMIT 5;

-- Test 5: Check sample data in stationary_purchases with tenant_id
SELECT 
    'Sample stationary_purchases with tenant_id' as info,
    id,
    total_amount,
    payment_date,
    tenant_id,
    created_at
FROM stationary_purchases 
LIMIT 5;

-- Test 6: Check users with tenant_id
SELECT 
    'Users with tenant assignments' as info,
    email,
    tenant_id,
    created_at
FROM users 
ORDER BY created_at 
LIMIT 5;
