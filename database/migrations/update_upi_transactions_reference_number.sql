-- Migration: Update UPI Transactions Table with Reference Number
-- Date: 2025-01-09
-- Description: Remove transaction_ref and bank_reference_number, add reference_number column

BEGIN;

-- Step 1: Add the new reference_number column
ALTER TABLE public.upi_transactions 
ADD COLUMN reference_number character varying(6) NULL;

-- Step 2: Create a temporary function to generate reference numbers for existing records
CREATE OR REPLACE FUNCTION temp_generate_reference_number(student_name TEXT)
RETURNS TEXT AS $$
DECLARE
    ref_num TEXT;
    counter INT := 0;
BEGIN
    LOOP
        -- Extract first 2 letters from student name (uppercase)
        ref_num := UPPER(SUBSTRING(REGEXP_REPLACE(student_name, '[^A-Za-z]', '', 'g'), 1, 2));
        
        -- If name has less than 2 letters, pad with random letters
        WHILE LENGTH(ref_num) < 2 LOOP
            ref_num := ref_num || CHR(65 + FLOOR(RANDOM() * 26)::INT);
        END LOOP;
        
        -- Add 4 random alphanumeric characters
        FOR i IN 1..4 LOOP
            IF RANDOM() < 0.5 THEN
                -- Add random letter
                ref_num := ref_num || CHR(65 + FLOOR(RANDOM() * 26)::INT);
            ELSE
                -- Add random number
                ref_num := ref_num || FLOOR(RANDOM() * 10)::TEXT;
            END IF;
        END LOOP;
        
        -- Check if this reference number already exists
        IF NOT EXISTS (SELECT 1 FROM upi_transactions WHERE reference_number = ref_num) THEN
            EXIT;
        END IF;
        
        -- Prevent infinite loop
        counter := counter + 1;
        IF counter > 1000 THEN
            -- Fallback: use UUID substring if we can't generate unique ref
            ref_num := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
            EXIT;
        END IF;
    END LOOP;
    
    RETURN ref_num;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update existing records with generated reference numbers
UPDATE public.upi_transactions 
SET reference_number = temp_generate_reference_number(
    COALESCE(
        (SELECT name FROM students WHERE students.id = upi_transactions.student_id), 
        'STUDENT'
    )
)
WHERE reference_number IS NULL;

-- Step 4: Make reference_number NOT NULL and UNIQUE
ALTER TABLE public.upi_transactions 
ALTER COLUMN reference_number SET NOT NULL;

ALTER TABLE public.upi_transactions 
ADD CONSTRAINT upi_transactions_reference_number_key UNIQUE (reference_number);

-- Step 5: Create index for reference_number
CREATE INDEX IF NOT EXISTS idx_upi_transactions_reference_number 
ON public.upi_transactions USING btree (reference_number) TABLESPACE pg_default;

-- Step 6: Drop the old columns and their constraints/indexes
-- First, drop the unique constraint on transaction_ref
ALTER TABLE public.upi_transactions 
DROP CONSTRAINT IF EXISTS upi_transactions_transaction_ref_key;

-- Drop the index on transaction_ref
DROP INDEX IF EXISTS idx_upi_transactions_transaction_ref;

-- Now drop the columns
ALTER TABLE public.upi_transactions 
DROP COLUMN IF EXISTS transaction_ref;

ALTER TABLE public.upi_transactions 
DROP COLUMN IF EXISTS bank_reference_number;

-- Step 7: Clean up temporary function
DROP FUNCTION IF EXISTS temp_generate_reference_number(TEXT);

-- Step 8: Update any views or functions that might reference the old columns
-- (Add any additional cleanup here if needed)

COMMIT;

-- Verification queries (run these after migration to verify)
-- SELECT reference_number, COUNT(*) FROM upi_transactions GROUP BY reference_number HAVING COUNT(*) > 1; -- Should return no rows (no duplicates)
-- SELECT COUNT(*) FROM upi_transactions WHERE reference_number IS NULL; -- Should return 0
-- SELECT reference_number FROM upi_transactions LIMIT 10; -- Sample reference numbers
