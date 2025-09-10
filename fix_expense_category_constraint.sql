-- Fix for Expense Category Unique Constraint Issue
-- The current unique constraint on expense_categories.name should be changed to (name, tenant_id)
-- This allows the same category names across different tenants

-- Step 1: Drop the existing unique constraint on name only
-- (Replace 'expense_categories_name_key' with the actual constraint name from your database)
ALTER TABLE school_expense_categories 
DROP CONSTRAINT IF EXISTS expense_categories_name_key;

-- Alternative constraint names that might exist:
-- DROP CONSTRAINT IF EXISTS school_expense_categories_name_key;
-- DROP CONSTRAINT IF EXISTS expense_categories_name_unique;

-- Step 2: Add a new unique constraint on (name, tenant_id)
ALTER TABLE school_expense_categories 
ADD CONSTRAINT expense_categories_name_tenant_unique 
UNIQUE (name, tenant_id);

-- Verify the constraint was added correctly
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'school_expense_categories' 
  AND constraint_type = 'UNIQUE';

-- Optional: Check current data for any duplicates that would violate the new constraint
SELECT name, tenant_id, COUNT(*) as count
FROM school_expense_categories
GROUP BY name, tenant_id
HAVING COUNT(*) > 1;

-- Note: If the query above returns any results, you have duplicate categories
-- for the same tenant that need to be cleaned up before the constraint can be applied.
