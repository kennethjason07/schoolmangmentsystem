-- Migration: Fix UPI database function to use reference_number
-- Date: 2025-01-09
-- Description: Update generate_upi_transaction_ref function to use reference_number column

BEGIN;

-- Drop the old function that references transaction_ref
DROP FUNCTION IF EXISTS generate_upi_transaction_ref(varchar);

-- Create new function that uses reference_number instead
CREATE OR REPLACE FUNCTION generate_upi_transaction_ref(student_admission_no varchar)
RETURNS varchar AS $$
DECLARE
  today_str varchar;
  sequence_num integer;
  transaction_ref varchar;
BEGIN
  today_str := to_char(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get next sequence number for today using reference_number column
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(reference_number FROM LENGTH(student_admission_no || '-' || today_str || '-') + 1)
      AS integer
    )
  ), 0) + 1
  INTO sequence_num
  FROM upi_transactions
  WHERE reference_number LIKE student_admission_no || '-' || today_str || '-%';
  
  transaction_ref := student_admission_no || '-' || today_str || '-' || LPAD(sequence_num::text, 3, '0');
  
  RETURN transaction_ref;
END;
$$ LANGUAGE plpgsql;

-- Update any other database objects that might reference transaction_ref
-- Drop and recreate the index if it exists with the old name
DROP INDEX IF EXISTS idx_upi_transactions_transaction_ref;

COMMIT;

-- Verification: Test the function to make sure it works
-- SELECT generate_upi_transaction_ref('ADM001');
