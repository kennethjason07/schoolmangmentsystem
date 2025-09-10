-- Update UPI Payment Status Constraint
-- This script adds PENDING_ADMIN_VERIFICATION to the allowed payment status values

-- Drop the existing constraint
ALTER TABLE public.upi_transactions 
DROP CONSTRAINT IF EXISTS upi_transactions_status_check;

-- Add the updated constraint with PENDING_ADMIN_VERIFICATION
ALTER TABLE public.upi_transactions 
ADD CONSTRAINT upi_transactions_status_check 
CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'PENDING_ADMIN_VERIFICATION'));

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ UPI payment status constraint updated successfully!';
  RAISE NOTICE 'New allowed values: PENDING, SUCCESS, FAILED, PENDING_ADMIN_VERIFICATION';
END $$;

COMMIT;
