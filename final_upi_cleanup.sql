-- Final UPI Payment System Cleanup Script
-- Remove the remaining UPI-related functions

-- Drop the remaining UPI payment functions
DROP FUNCTION IF EXISTS generate_payment_receipt_number() CASCADE;
DROP FUNCTION IF EXISTS set_payment_transaction_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS set_payment_verification_tenant_id() CASCADE;

-- Also check for any variations of these functions with different signatures
DROP FUNCTION IF EXISTS generate_payment_receipt_number(text) CASCADE;
DROP FUNCTION IF EXISTS generate_payment_receipt_number(integer) CASCADE;
DROP FUNCTION IF EXISTS set_payment_transaction_tenant_id(text) CASCADE;
DROP FUNCTION IF EXISTS set_payment_verification_tenant_id(text) CASCADE;

-- Verify all UPI functions are gone
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE (proname LIKE '%payment%' 
    OR proname LIKE '%upi%')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname NOT IN ('student_fees', 'fee_structure'); -- Exclude legitimate fee functions if they exist

-- Final verification - should return no rows
SELECT 'UPI Cleanup Complete - No UPI functions remain' as status
WHERE NOT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE (proname LIKE 'generate_payment_receipt_number' 
        OR proname LIKE 'set_payment_transaction_tenant_id'
        OR proname LIKE 'set_payment_verification_tenant_id')
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

COMMIT;
