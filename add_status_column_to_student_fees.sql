-- =========================================================================================================
-- ADD STATUS COLUMN TO STUDENT_FEES TABLE
-- =========================================================================================================
-- This script adds a status column to the student_fees table to track payment status
-- Status values: 'pending', 'partial', 'paid', 'overdue'
-- This will integrate with the Fee Management screen which already handles these statuses
-- =========================================================================================================

BEGIN;

-- Step 1: Check if status column already exists and add it if needed
DO $$
BEGIN
    -- Check if the status column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'student_fees' 
        AND column_name = 'status'
    ) THEN
        -- Add the status column
        ALTER TABLE public.student_fees 
        ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
        
        -- Add check constraint for valid status values
        ALTER TABLE public.student_fees 
        ADD CONSTRAINT student_fees_status_check 
        CHECK (status IN ('pending', 'partial', 'paid', 'overdue'));
        
        RAISE NOTICE '✅ Status column added to student_fees table';
    ELSE
        RAISE NOTICE '⚠️ Status column already exists in student_fees table';
    END IF;
END $$;

-- Step 2: Update existing records with appropriate status values
DO $$
DECLARE
    rec RECORD;
    total_fee_amount NUMERIC;
    amount_paid NUMERIC;
    calculated_status VARCHAR(20);
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Updating existing student_fees records with calculated status...';
    
    -- Loop through each student fee record that doesn't have a status
    FOR rec IN (
        SELECT 
            sf.id as fee_id,
            sf.student_id,
            sf.fee_component,
            sf.amount_paid,
            sf.academic_year,
            sf.tenant_id,
            sf.payment_date
        FROM public.student_fees sf 
        WHERE sf.status IS NULL OR sf.status = 'pending'
    ) LOOP
        -- Get the total fee amount from fee_structure for this fee component and student's class
        SELECT COALESCE(fs.amount, 0) INTO total_fee_amount
        FROM public.fee_structure fs
        INNER JOIN public.students s ON s.tenant_id = fs.tenant_id
        WHERE fs.tenant_id = rec.tenant_id
        AND fs.fee_component = rec.fee_component
        AND fs.academic_year = rec.academic_year
        AND s.id = rec.student_id
        AND (fs.class_id = s.class_id OR fs.student_id = rec.student_id)
        LIMIT 1;
        
        -- If no fee structure found, use a default logic
        IF total_fee_amount IS NULL OR total_fee_amount = 0 THEN
            total_fee_amount := rec.amount_paid; -- Assume paid amount is the full fee
        END IF;
        
        amount_paid := COALESCE(rec.amount_paid, 0);
        
        -- Calculate status based on payment vs total fee
        IF amount_paid = 0 THEN
            calculated_status := 'pending';
        ELSIF amount_paid >= total_fee_amount THEN
            calculated_status := 'paid';
        ELSE
            calculated_status := 'partial';
        END IF;
        
        -- Check if payment is overdue (due date has passed and not fully paid)
        IF calculated_status != 'paid' THEN
            -- Check if there's a due date in fee_structure and if it's passed
            IF EXISTS (
                SELECT 1 FROM public.fee_structure fs
                INNER JOIN public.students s ON s.tenant_id = fs.tenant_id
                WHERE fs.tenant_id = rec.tenant_id
                AND fs.fee_component = rec.fee_component
                AND fs.academic_year = rec.academic_year
                AND s.id = rec.student_id
                AND (fs.class_id = s.class_id OR fs.student_id = rec.student_id)
                AND fs.due_date < CURRENT_DATE
                LIMIT 1
            ) THEN
                calculated_status := 'overdue';
            END IF;
        END IF;
        
        -- Update the record with calculated status
        UPDATE public.student_fees 
        SET status = calculated_status
        WHERE id = rec.fee_id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Updated % student_fees records with calculated status', updated_count;
END $$;

-- Step 3: Add performance indexes
DO $$
BEGIN
    -- Add an index on the status column for better query performance
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'student_fees' 
        AND indexname = 'idx_student_fees_status'
    ) THEN
        CREATE INDEX idx_student_fees_status ON public.student_fees (status);
        RAISE NOTICE '✅ Created index on status column';
    END IF;

    -- Add an index on status and tenant_id combination for tenant-aware queries
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'student_fees' 
        AND indexname = 'idx_student_fees_status_tenant'
    ) THEN
        CREATE INDEX idx_student_fees_status_tenant ON public.student_fees (tenant_id, status);
        RAISE NOTICE '✅ Created combined index on tenant_id and status';
    END IF;
    
    RAISE NOTICE '✅ Added performance indexes for status column';
END $$;

-- Step 4: Create a function to automatically set status when inserting/updating student_fees
CREATE OR REPLACE FUNCTION public.calculate_student_fee_status()
RETURNS TRIGGER AS $$
DECLARE
    total_fee_amount NUMERIC := 0;
    calculated_status VARCHAR(20) := 'pending';
BEGIN
    -- Get the total fee amount from fee_structure
    SELECT COALESCE(fs.amount, NEW.amount_paid) INTO total_fee_amount
    FROM public.fee_structure fs
    INNER JOIN public.students s ON s.tenant_id = fs.tenant_id
    WHERE fs.tenant_id = NEW.tenant_id
    AND fs.fee_component = NEW.fee_component
    AND fs.academic_year = NEW.academic_year
    AND s.id = NEW.student_id
    AND (fs.class_id = s.class_id OR fs.student_id = NEW.student_id)
    LIMIT 1;
    
    -- Calculate status
    IF NEW.amount_paid = 0 THEN
        calculated_status := 'pending';
    ELSIF NEW.amount_paid >= total_fee_amount THEN
        calculated_status := 'paid';
    ELSE
        calculated_status := 'partial';
    END IF;
    
    -- Check for overdue status
    IF calculated_status != 'paid' THEN
        IF EXISTS (
            SELECT 1 FROM public.fee_structure fs
            INNER JOIN public.students s ON s.tenant_id = fs.tenant_id
            WHERE fs.tenant_id = NEW.tenant_id
            AND fs.fee_component = NEW.fee_component
            AND fs.academic_year = NEW.academic_year
            AND s.id = NEW.student_id
            AND (fs.class_id = s.class_id OR fs.student_id = NEW.student_id)
            AND fs.due_date < CURRENT_DATE
            LIMIT 1
        ) THEN
            calculated_status := 'overdue';
        END IF;
    END IF;
    
    -- Set the calculated status
    NEW.status := calculated_status;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to automatically calculate status on insert/update
DO $$
BEGIN
    -- Drop existing trigger if it exists
    DROP TRIGGER IF EXISTS trigger_calculate_student_fee_status ON public.student_fees;
    
    -- Create new trigger
    CREATE TRIGGER trigger_calculate_student_fee_status
        BEFORE INSERT OR UPDATE ON public.student_fees
        FOR EACH ROW
        EXECUTE FUNCTION public.calculate_student_fee_status();
    
    RAISE NOTICE '✅ Created trigger to automatically calculate status on insert/update';
END $$;

COMMIT;

-- Verification queries (these will show results after the transaction commits)

-- Show current status distribution
SELECT 
    'STATUS DISTRIBUTION' as info,
    status,
    COUNT(*) as count,
    ROUND(AVG(amount_paid), 2) as avg_amount_paid
FROM public.student_fees 
WHERE tenant_id IS NOT NULL
GROUP BY status
ORDER BY status;

-- Show sample records with the new status
SELECT 
    'SAMPLE RECORDS WITH STATUS' as info,
    sf.id,
    sf.fee_component,
    sf.amount_paid,
    sf.status,
    sf.payment_date,
    s.name as student_name
FROM public.student_fees sf
LEFT JOIN public.students s ON sf.student_id = s.id
WHERE sf.tenant_id IS NOT NULL
ORDER BY sf.created_at DESC
LIMIT 5;

-- Final success message
SELECT 
    '🎉 STATUS COLUMN SUCCESSFULLY ADDED!' as result,
    'Status values: pending, partial, paid, overdue' as status_values,
    'Automatic calculation enabled via trigger' as automation,
    'Integrates with Fee Management screen' as integration;

-- Usage examples for developers
SELECT 
    'USAGE EXAMPLES:' as section,
    '1. SELECT * FROM student_fees WHERE status = ''pending''' as query_pending,
    '2. SELECT * FROM student_fees WHERE status = ''overdue''' as query_overdue,
    '3. Status auto-updates when amount_paid changes' as auto_update;
