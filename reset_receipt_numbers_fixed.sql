-- Reset receipt numbers to start from 1000

-- 1. First, temporarily remove the NOT NULL constraint if it exists
ALTER TABLE student_fees ALTER COLUMN receipt_number DROP NOT NULL;

-- 2. Clear existing receipt numbers (if you want to start fresh)
UPDATE student_fees SET receipt_number = NULL;

-- 3. Reset the sequence to start from 1000
ALTER SEQUENCE receipt_number_seq RESTART WITH 1000;

-- 4. Update existing records with new sequential receipt numbers starting from 1000
DO $$
DECLARE
    rec RECORD;
    current_receipt_num INTEGER := 1000;
BEGIN
    FOR rec IN 
        SELECT id 
        FROM student_fees 
        ORDER BY created_at ASC
    LOOP
        UPDATE student_fees 
        SET receipt_number = current_receipt_num 
        WHERE id = rec.id;
        current_receipt_num := current_receipt_num + 1;
    END LOOP;
    
    -- Update the sequence to the next available number
    PERFORM setval('receipt_number_seq', current_receipt_num);
END $$;

-- 5. Add back the NOT NULL constraint
ALTER TABLE student_fees ALTER COLUMN receipt_number SET NOT NULL;

-- 6. Verify the changes
SELECT 
    id,
    receipt_number,
    fee_component,
    amount_paid,
    created_at
FROM student_fees 
ORDER BY receipt_number ASC
LIMIT 10;

-- 7. Check the current sequence value
SELECT currval('receipt_number_seq') as current_sequence_value;

-- 8. Test getting the next receipt number
SELECT nextval('receipt_number_seq') as next_receipt_number;
