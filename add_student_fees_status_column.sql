-- Add status column to student_fees table for partial payment tracking
-- This script adds a status column and remaining_amount column to handle partial payments

-- Add status column with default value 'pending'
ALTER TABLE public.student_fees 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Add remaining_amount column to track unpaid balance
ALTER TABLE public.student_fees 
ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(10, 2) DEFAULT 0;

-- Add total_amount column to store original fee amount
ALTER TABLE public.student_fees 
ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0;

-- Create check constraint for status values
ALTER TABLE public.student_fees 
DROP CONSTRAINT IF EXISTS student_fees_status_check;

ALTER TABLE public.student_fees 
ADD CONSTRAINT student_fees_status_check 
CHECK (status IN ('pending', 'partial', 'full', 'overdue', 'cancelled'));

-- Update existing records to set total_amount = amount_paid and status = 'full' where amount_paid > 0
UPDATE public.student_fees 
SET 
  total_amount = amount_paid,
  remaining_amount = 0,
  status = 'full'
WHERE amount_paid > 0 AND total_amount = 0;

-- Update records with no payment to 'pending' status
UPDATE public.student_fees 
SET 
  status = 'pending',
  remaining_amount = COALESCE(total_amount, amount_paid),
  total_amount = GREATEST(COALESCE(total_amount, 0), amount_paid)
WHERE amount_paid = 0 OR amount_paid IS NULL;

-- Create index for status column for better query performance
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON public.student_fees(status);

-- Add comment to document the new columns
COMMENT ON COLUMN public.student_fees.status IS 'Payment status: pending, partial, full, overdue, cancelled';
COMMENT ON COLUMN public.student_fees.remaining_amount IS 'Remaining unpaid amount for partial payments';
COMMENT ON COLUMN public.student_fees.total_amount IS 'Original total fee amount before any payments';

-- Print success message
DO $$
BEGIN
  RAISE NOTICE '✅ Student fees status columns added successfully!';
  RAISE NOTICE 'Added columns: status, remaining_amount, total_amount';
  RAISE NOTICE 'Status values: pending, partial, full, overdue, cancelled';
END $$;

COMMIT;
