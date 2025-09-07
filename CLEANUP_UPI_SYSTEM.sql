-- CLEANUP SCRIPT: Remove all UPI payment system components
-- Run this script in your PostgreSQL database to remove everything

-- 1. Drop views first (dependencies)
DROP VIEW IF EXISTS payment_transactions_with_student_details CASCADE;

-- 2. Drop triggers
DROP TRIGGER IF EXISTS payment_transactions_set_tenant_id ON public.payment_transactions;
DROP TRIGGER IF EXISTS payment_verifications_set_tenant_id ON public.payment_verifications;

-- 3. Drop functions
DROP FUNCTION IF EXISTS set_payment_transaction_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS set_payment_verification_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS generate_payment_receipt_number() CASCADE;
DROP FUNCTION IF EXISTS public.set_config(text, text, boolean) CASCADE;

-- 4. Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS public.payment_verifications CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;

-- 5. Remove UPI from student_fees payment_mode constraint (restore original)
ALTER TABLE public.student_fees 
DROP CONSTRAINT IF EXISTS student_fees_payment_mode_check;

ALTER TABLE public.student_fees 
ADD CONSTRAINT student_fees_payment_mode_check 
CHECK (payment_mode = ANY (ARRAY['Cash'::text, 'Card'::text, 'Online'::text]));

-- 6. Drop any remaining policies
DROP POLICY IF EXISTS "payment_transactions_tenant_isolation" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_verifications_tenant_isolation" ON public.payment_verifications;

-- Success message
SELECT 'UPI Payment System completely removed from database!' as cleanup_status;
