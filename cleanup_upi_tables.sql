-- Complete UPI Payment System Cleanup Script
-- This script will remove all remaining UPI-related tables, views, functions, and policies

-- Drop the view first (depends on tables)
DROP VIEW IF EXISTS payment_transactions_with_student_details;

-- Drop tables (with CASCADE to remove any dependencies)
DROP TABLE IF EXISTS payment_verifications CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;

-- Drop any custom functions (skip built-in PostgreSQL functions)
-- Note: set_config is a built-in PostgreSQL function, so we skip it
DROP FUNCTION IF EXISTS current_setting_safe(text);

-- Drop any RLS policies (if they still exist)
-- Note: These will be automatically dropped with the tables, but including for completeness

-- Clean up any sequences that might have been created
DROP SEQUENCE IF EXISTS payment_transactions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS payment_verifications_id_seq CASCADE;

-- Drop any custom types related to UPI payments
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS verification_status CASCADE;

-- Drop any indexes that might remain
-- (These should be automatically dropped with tables, but being thorough)
DROP INDEX IF EXISTS idx_payment_transactions_student_id;
DROP INDEX IF EXISTS idx_payment_transactions_status;
DROP INDEX IF EXISTS idx_payment_transactions_created_at;
DROP INDEX IF EXISTS idx_payment_verifications_transaction_id;
DROP INDEX IF EXISTS idx_payment_verifications_status;

-- Verify cleanup
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE tablename LIKE '%payment_%' 
    AND tablename NOT IN ('student_fees', 'fee_structure')
    AND schemaname = 'public';

-- List any remaining functions
SELECT 
    proname as function_name,
    prosrc as function_definition
FROM pg_proc 
WHERE proname LIKE '%payment%' 
    OR proname LIKE '%upi%'
    OR proname LIKE '%set_config%';

-- List any remaining views
SELECT 
    schemaname,
    viewname
FROM pg_views 
WHERE viewname LIKE '%payment%' 
    AND schemaname = 'public';

COMMIT;
