-- Fix student_fees table logic issues
-- This script addresses the status calculation, amount fields, and trigger function

-- First, let's create or replace the calculate_student_fee_status function
CREATE OR REPLACE FUNCTION public.calculate_student_fee_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- For INSERT operations, set initial values
    IF TG_OP = 'INSERT' THEN
        -- If total_amount is not provided or is 0, set it equal to amount_paid
        IF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
            NEW.total_amount := NEW.amount_paid;
        END IF;
        
        -- Calculate remaining amount
        NEW.remaining_amount := NEW.total_amount - NEW.amount_paid;
        
        -- Determine status based on payment
        IF NEW.amount_paid >= NEW.total_amount THEN
            NEW.status := 'full';
            NEW.remaining_amount := 0;
        ELSIF NEW.amount_paid > 0 THEN
            NEW.status := 'partial';
        ELSE
            NEW.status := 'pending';
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- For UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        -- Recalculate remaining amount
        NEW.remaining_amount := NEW.total_amount - NEW.amount_paid;
        
        -- Determine status based on payment
        IF NEW.amount_paid >= NEW.total_amount THEN
            NEW.status := 'full';
            NEW.remaining_amount := 0;
        ELSIF NEW.amount_paid > 0 THEN
            NEW.status := 'partial';
        ELSE
            NEW.status := 'pending';
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$function$;

-- Update existing records to fix the status and amounts
-- This will recalculate status for existing records where total_amount is 0
UPDATE public.student_fees 
SET 
    total_amount = CASE 
        WHEN total_amount = 0 OR total_amount IS NULL THEN amount_paid 
        ELSE total_amount 
    END,
    remaining_amount = CASE 
        WHEN total_amount = 0 OR total_amount IS NULL THEN 0
        ELSE total_amount - amount_paid 
    END,
    status = CASE 
        WHEN total_amount = 0 OR total_amount IS NULL THEN 'full'
        WHEN amount_paid >= total_amount THEN 'full'
        WHEN amount_paid > 0 THEN 'partial'
        ELSE 'pending'
    END
WHERE status != 'cancelled';

-- Create a function to get fee structure for a student (if not exists)
CREATE OR REPLACE FUNCTION public.get_fee_structure(
    p_student_id UUID,
    p_tenant_id UUID,
    p_academic_year TEXT
)
RETURNS TABLE(
    fee_component TEXT,
    total_amount NUMERIC(10,2)
)
LANGUAGE plpgsql
AS $function$
BEGIN
    -- This is a placeholder - you should implement based on your fee structure
    -- For now, return common fee components with default amounts
    RETURN QUERY
    SELECT 
        'Tuition Fee'::TEXT as fee_component,
        5000.00::NUMERIC(10,2) as total_amount
    UNION ALL
    SELECT 
        'Bus Fee'::TEXT as fee_component,
        2500.00::NUMERIC(10,2) as total_amount
    UNION ALL
    SELECT 
        'Library Fee'::TEXT as fee_component,
        500.00::NUMERIC(10,2) as total_amount
    UNION ALL
    SELECT 
        'Sports Fee'::TEXT as fee_component,
        1000.00::NUMERIC(10,2) as total_amount;
END;
$function$;

-- Add a comment to track the fix
COMMENT ON FUNCTION public.calculate_student_fee_status() IS 'Fixed function to properly calculate student fee status, total_amount, and remaining_amount - Updated 2025-09-10';
