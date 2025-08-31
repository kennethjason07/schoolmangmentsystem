-- Verify that receipt numbers are working correctly

-- 1. Check if the receipt_number column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'student_fees' AND column_name = 'receipt_number';

-- 2. Check if the sequence exists
SELECT sequence_name, start_value, increment, last_value 
FROM information_schema.sequences 
WHERE sequence_name = 'receipt_number_seq';

-- 3. Check existing student_fees records with receipt numbers
SELECT 
    id,
    receipt_number,
    fee_component,
    amount_paid,
    payment_date,
    student_id,
    created_at
FROM student_fees 
WHERE receipt_number IS NOT NULL
ORDER BY receipt_number ASC
LIMIT 10;

-- 4. Check total count of records with and without receipt numbers
SELECT 
    COUNT(*) as total_records,
    COUNT(receipt_number) as records_with_receipt_number,
    COUNT(*) - COUNT(receipt_number) as records_without_receipt_number
FROM student_fees;

-- 5. Get the next sequence value (this will increment the sequence)
SELECT nextval('receipt_number_seq') as next_receipt_number;

-- 6. Check the current sequence value without incrementing
SELECT last_value as current_sequence_value FROM receipt_number_seq;

-- 7. Sample insert to test receipt number assignment (REMOVE STUDENT_ID CONSTRAINT FOR TESTING)
-- INSERT INTO student_fees (
--     fee_component,
--     amount_paid,
--     payment_mode,
--     payment_date,
--     academic_year,
--     remarks
-- ) VALUES (
--     'Test Fee',
--     100.00,
--     'Test',
--     CURRENT_DATE,
--     '2024-2025',
--     'Test receipt number generation'
-- );

-- 8. View the most recent records
SELECT 
    id,
    receipt_number,
    fee_component,
    amount_paid,
    payment_date,
    created_at
FROM student_fees 
ORDER BY created_at DESC
LIMIT 5;
