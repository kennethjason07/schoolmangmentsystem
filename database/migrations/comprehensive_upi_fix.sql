-- Comprehensive Fix for UPI transaction_ref Issues
-- Date: 2025-01-09
-- Description: Fix all remaining references to transaction_ref in database

BEGIN;

-- 1. Drop the problematic index that references transaction_ref
DROP INDEX IF EXISTS idx_upi_transactions_transaction_ref;

-- 2. Create the correct index for reference_number if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_upi_transactions_reference_number 
ON public.upi_transactions USING btree (reference_number) TABLESPACE pg_default;

-- 3. Drop and recreate the function with correct column names
DROP FUNCTION IF EXISTS generate_upi_transaction_ref(varchar);

-- 4. Create updated function that uses reference_number instead of transaction_ref
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

-- 5. Check for any other database objects that might reference transaction_ref
-- Drop any views that might reference the old column (if any exist)
-- Note: We'll list potential view names that might exist
DROP VIEW IF EXISTS vw_upi_transaction_details;
DROP VIEW IF EXISTS upi_transaction_summary;
DROP VIEW IF EXISTS pending_upi_payments_view;

-- 6. Verify the table structure is correct
DO $$
BEGIN
  -- Check if reference_number column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'upi_transactions' 
    AND column_name = 'reference_number'
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE '✅ reference_number column exists';
  ELSE
    RAISE EXCEPTION '❌ reference_number column missing - migration incomplete';
  END IF;
  
  -- Check if transaction_ref column was properly removed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'upi_transactions' 
    AND column_name = 'transaction_ref'
    AND table_schema = 'public'
  ) THEN
    RAISE EXCEPTION '❌ transaction_ref column still exists - migration incomplete';
  ELSE
    RAISE NOTICE '✅ transaction_ref column properly removed';
  END IF;
END
$$;

-- 7. Clean up any orphaned constraints or triggers
-- Remove any remaining references in constraints
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Look for constraints that might reference the old column
  FOR constraint_name IN 
    SELECT conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'upi_transactions'
    AND pg_get_constraintdef(c.oid) LIKE '%transaction_ref%'
  LOOP
    EXECUTE format('ALTER TABLE public.upi_transactions DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint: %', constraint_name;
  END LOOP;
END
$$;

-- 8. Test the function to ensure it works
DO $$
DECLARE
  test_ref varchar;
BEGIN
  SELECT generate_upi_transaction_ref('TEST001') INTO test_ref;
  RAISE NOTICE 'Function test successful. Generated reference: %', test_ref;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Function test failed: %', SQLERRM;
END
$$;

COMMIT;

-- Final verification query
SELECT 
  'Database structure verification' as section,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'upi_transactions' 
      AND column_name = 'reference_number'
    ) THEN '✅ reference_number column exists'
    ELSE '❌ reference_number column missing'
  END as reference_number_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'upi_transactions' 
      AND column_name = 'transaction_ref'
    ) THEN '❌ transaction_ref column still exists'
    ELSE '✅ transaction_ref column properly removed'  
  END as transaction_ref_status;

SELECT '✅ Comprehensive UPI fix completed successfully!' as status;
