-- Fix Expense Categories Multi-Tenant Unique Constraint Issue
-- ============================================================
-- 
-- Problem: The expense_categories table has a global unique constraint on 'name',
-- which prevents different tenants from having categories with the same names.
-- 
-- Solution: Replace the global unique constraint with a tenant-scoped constraint.

-- Step 1: Check current constraint name
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'expense_categories' 
    AND tc.constraint_type = 'UNIQUE';

-- Step 2: Drop existing unique constraint on name only
-- (Try multiple possible constraint names)
DO $$
BEGIN
    -- Try common constraint name patterns
    BEGIN
        ALTER TABLE expense_categories DROP CONSTRAINT expense_categories_name_key;
        RAISE NOTICE 'Dropped constraint: expense_categories_name_key';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint expense_categories_name_key does not exist';
    END;
    
    BEGIN
        ALTER TABLE expense_categories DROP CONSTRAINT expense_categories_name_unique;
        RAISE NOTICE 'Dropped constraint: expense_categories_name_unique';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint expense_categories_name_unique does not exist';
    END;
    
    BEGIN
        ALTER TABLE expense_categories DROP CONSTRAINT expense_categories_name;
        RAISE NOTICE 'Dropped constraint: expense_categories_name';
    EXCEPTION
        WHEN undefined_object THEN
            RAISE NOTICE 'Constraint expense_categories_name does not exist';
    END;
END $$;

-- Step 3: Add new tenant-scoped unique constraint
ALTER TABLE expense_categories 
ADD CONSTRAINT expense_categories_name_tenant_unique 
UNIQUE (name, tenant_id);

-- Step 4: Verify the new constraint was created
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'expense_categories' 
    AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.constraint_name, tc.constraint_type;

-- Step 5: Check for any duplicate data that would violate the new constraint
SELECT 
    name, 
    tenant_id, 
    COUNT(*) as duplicate_count,
    string_agg(id::text, ', ') as duplicate_ids
FROM expense_categories
GROUP BY name, tenant_id
HAVING COUNT(*) > 1;

-- Step 6: Optional - Clean up any duplicate data if found
-- (Uncomment and modify as needed if duplicates exist)
/*
-- Example cleanup for duplicates (keep the oldest record for each name/tenant combo):
DELETE FROM expense_categories
WHERE id NOT IN (
    SELECT MIN(id)
    FROM expense_categories
    GROUP BY name, tenant_id
);
*/

-- Step 7: Verify tenant isolation is working correctly
-- This should show categories grouped by tenant
SELECT 
    t.name AS tenant_name,
    ec.name AS category_name,
    ec.monthly_budget,
    COUNT(*) OVER (PARTITION BY ec.tenant_id) as categories_per_tenant
FROM expense_categories ec
JOIN tenants t ON t.id = ec.tenant_id
ORDER BY t.name, ec.name;

-- Step 8: Test the new constraint by trying to create duplicate categories
-- (This should succeed - same name, different tenants)
/*
-- Example test (replace with actual tenant IDs):
INSERT INTO expense_categories (name, tenant_id, monthly_budget) VALUES 
    ('Test Category', 'tenant-id-1', 10000),
    ('Test Category', 'tenant-id-2', 20000);  -- This should work now

-- This should fail (same name, same tenant):
INSERT INTO expense_categories (name, tenant_id, monthly_budget) VALUES 
    ('Test Category', 'tenant-id-1', 30000);  -- This should fail
*/

-- Success message
SELECT 'Expense categories multi-tenant constraint fix completed successfully!' as status;
