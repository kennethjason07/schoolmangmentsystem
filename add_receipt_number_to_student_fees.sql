-- Add receipt_number field to student_fees table
-- This will provide sequential receipt numbers starting from 1000

-- Step 1: Add the receipt_number column to student_fees table
ALTER TABLE public.student_fees 
ADD COLUMN receipt_number BIGINT UNIQUE;

-- Step 2: Create a sequence for receipt numbers starting from 1000
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO MAXVALUE
  NO MINVALUE
  CACHE 1;

-- Step 3: Update existing records with receipt numbers
UPDATE public.student_fees 
SET receipt_number = nextval('receipt_number_seq')
WHERE receipt_number IS NULL;

-- Step 4: Set default value for new records
ALTER TABLE public.student_fees 
ALTER COLUMN receipt_number SET DEFAULT nextval('receipt_number_seq');

-- Step 5: Make receipt_number NOT NULL
ALTER TABLE public.student_fees 
ALTER COLUMN receipt_number SET NOT NULL;

-- Step 6: Create an index on receipt_number for better performance
CREATE INDEX IF NOT EXISTS idx_student_fees_receipt_number ON public.student_fees(receipt_number);

-- Step 7: Create a function to get the next receipt number
CREATE OR REPLACE FUNCTION get_next_receipt_number()
RETURNS BIGINT AS $$
BEGIN
  RETURN nextval('receipt_number_seq');
END;
$$ LANGUAGE plpgsql;

-- Step 8: Grant permissions on the sequence
GRANT USAGE, SELECT ON SEQUENCE receipt_number_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE receipt_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE receipt_number_seq TO service_role;

COMMENT ON COLUMN public.student_fees.receipt_number IS 'Sequential receipt number starting from 1000';
COMMENT ON SEQUENCE receipt_number_seq IS 'Sequence for generating unique receipt numbers starting from 1000';
COMMENT ON FUNCTION get_next_receipt_number() IS 'Function to get the next receipt number from the sequence';
