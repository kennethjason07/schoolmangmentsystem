-- =====================================================
-- STUDENT DISCOUNT SYSTEM IMPLEMENTATION
-- =====================================================

-- 1. Create student_discounts table
CREATE TABLE public.student_discounts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    class_id UUID NOT NULL,
    academic_year TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value NUMERIC(10, 2) NOT NULL,
    fee_component TEXT NULL, -- NULL means applies to all fee components
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NULL, -- admin who created the discount
    
    CONSTRAINT student_discounts_pkey PRIMARY KEY (id),
    CONSTRAINT student_discounts_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
    CONSTRAINT student_discounts_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id) ON DELETE CASCADE,
    CONSTRAINT student_discounts_check_value CHECK (
        (discount_type = 'percentage' AND discount_value >= 0 AND discount_value <= 100) OR
        (discount_type = 'fixed_amount' AND discount_value >= 0)
    )
);

-- 2. Add discount-related columns to fee_structure table
ALTER TABLE public.fee_structure 
ADD COLUMN IF NOT EXISTS base_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10, 2) DEFAULT 0;

-- Update existing records to set base_amount = amount where base_amount is null
UPDATE public.fee_structure 
SET base_amount = amount 
WHERE base_amount IS NULL;

-- Make base_amount NOT NULL after setting values
ALTER TABLE public.fee_structure 
ALTER COLUMN base_amount SET NOT NULL;

-- 3. Create function to calculate discounted fee for a student
CREATE OR REPLACE FUNCTION calculate_student_fee(
    p_student_id UUID,
    p_class_id UUID,
    p_academic_year TEXT,
    p_fee_component TEXT,
    p_base_amount NUMERIC
) RETURNS TABLE(
    final_amount NUMERIC,
    discount_amount NUMERIC,
    discount_type TEXT,
    discount_value NUMERIC
) AS $$
DECLARE
    v_discount_amount NUMERIC := 0;
    v_final_amount NUMERIC;
    v_discount_type TEXT := NULL;
    v_discount_value NUMERIC := 0;
BEGIN
    -- Get applicable discount for the student
    SELECT 
        CASE 
            WHEN sd.discount_type = 'percentage' THEN (p_base_amount * sd.discount_value / 100)
            WHEN sd.discount_type = 'fixed_amount' THEN sd.discount_value
            ELSE 0
        END,
        sd.discount_type,
        sd.discount_value
    INTO v_discount_amount, v_discount_type, v_discount_value
    FROM student_discounts sd
    WHERE sd.student_id = p_student_id 
        AND sd.class_id = p_class_id
        AND sd.academic_year = p_academic_year
        AND (sd.fee_component = p_fee_component OR sd.fee_component IS NULL)
        AND sd.is_active = true
    ORDER BY sd.fee_component NULLS LAST -- Specific component discounts take precedence
    LIMIT 1;
    
    v_final_amount := p_base_amount - COALESCE(v_discount_amount, 0);
    
    RETURN QUERY SELECT 
        GREATEST(v_final_amount, 0) as final_amount,
        COALESCE(v_discount_amount, 0) as discount_amount,
        v_discount_type,
        v_discount_value;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to apply discounts to fee structure
CREATE OR REPLACE FUNCTION apply_discount_to_fee_structure(
    p_student_id UUID,
    p_class_id UUID,
    p_academic_year TEXT
) RETURNS VOID AS $$
DECLARE
    fee_record RECORD;
    discount_result RECORD;
BEGIN
    -- Loop through all fee structures for the student's class
    FOR fee_record IN 
        SELECT id, fee_component, base_amount, academic_year
        FROM fee_structure 
        WHERE class_id = p_class_id 
        AND academic_year = p_academic_year
        AND (student_id = p_student_id OR student_id IS NULL)
    LOOP
        -- Calculate discount for this fee
        SELECT * INTO discount_result 
        FROM calculate_student_fee(
            p_student_id, 
            p_class_id, 
            fee_record.academic_year, 
            fee_record.fee_component, 
            fee_record.base_amount
        );
        
        -- Update the fee structure with calculated amounts
        UPDATE fee_structure 
        SET 
            amount = discount_result.final_amount,
            discount_applied = discount_result.discount_amount
        WHERE id = fee_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to get students with their discount information
CREATE OR REPLACE FUNCTION get_students_with_discounts(
    p_class_id UUID,
    p_academic_year TEXT
) RETURNS TABLE(
    student_id UUID,
    student_name TEXT,
    total_fee NUMERIC,
    total_discount NUMERIC,
    final_fee NUMERIC,
    discount_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.name as student_name,
        COALESCE(SUM(fs.base_amount), 0) as total_fee,
        COALESCE(SUM(fs.discount_applied), 0) as total_discount,
        COALESCE(SUM(fs.amount), 0) as final_fee,
        COALESCE(COUNT(sd.id), 0)::INTEGER as discount_count
    FROM students s
    LEFT JOIN fee_structure fs ON s.class_id = fs.class_id 
        AND fs.academic_year = p_academic_year
        AND (fs.student_id = s.id OR fs.student_id IS NULL)
    LEFT JOIN student_discounts sd ON s.id = sd.student_id 
        AND sd.class_id = p_class_id
        AND sd.academic_year = p_academic_year
        AND sd.is_active = true
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.name
    ORDER BY s.name;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to automatically apply discounts when discount is added/updated
CREATE OR REPLACE FUNCTION trigger_apply_discount()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply discount to existing fee structures
    PERFORM apply_discount_to_fee_structure(
        NEW.student_id,
        NEW.class_id,
        NEW.academic_year
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER student_discount_trigger
    AFTER INSERT OR UPDATE ON student_discounts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_apply_discount();

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_student_discounts_student_class 
ON student_discounts(student_id, class_id, academic_year);

CREATE INDEX IF NOT EXISTS idx_student_discounts_active 
ON student_discounts(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fee_structure_class_year 
ON fee_structure(class_id, academic_year);

-- 8. Create view for easy discount reporting
CREATE OR REPLACE VIEW discount_summary AS
SELECT 
    sd.id,
    s.name as student_name,
    c.class_name,
    c.section,
    sd.academic_year,
    sd.fee_component,
    sd.discount_type,
    sd.discount_value,
    sd.description,
    sd.is_active,
    sd.created_at,
    -- Calculate actual discount amount applied
    CASE 
        WHEN sd.fee_component IS NOT NULL THEN
            (SELECT 
                CASE 
                    WHEN sd.discount_type = 'percentage' THEN (fs.base_amount * sd.discount_value / 100)
                    WHEN sd.discount_type = 'fixed_amount' THEN sd.discount_value
                    ELSE 0
                END
                FROM fee_structure fs 
                WHERE fs.class_id = sd.class_id 
                AND fs.academic_year = sd.academic_year
                AND fs.fee_component = sd.fee_component
                LIMIT 1
            )
        ELSE
            (SELECT 
                SUM(
                    CASE 
                        WHEN sd.discount_type = 'percentage' THEN (fs.base_amount * sd.discount_value / 100)
                        WHEN sd.discount_type = 'fixed_amount' THEN sd.discount_value
                        ELSE 0
                    END
                )
                FROM fee_structure fs 
                WHERE fs.class_id = sd.class_id 
                AND fs.academic_year = sd.academic_year
            )
    END as actual_discount_amount
FROM student_discounts sd
JOIN students s ON sd.student_id = s.id
JOIN classes c ON sd.class_id = c.id;

-- 9. Sample data for testing (optional - remove in production)
-- Insert sample discount data
INSERT INTO student_discounts (student_id, class_id, academic_year, discount_type, discount_value, description)
SELECT 
    s.id,
    s.class_id,
    '2024-25',
    'percentage',
    10.0,
    'Merit scholarship - 10% discount'
FROM students s
JOIN classes c ON s.class_id = c.id
WHERE c.class_name = '10th'
LIMIT 3;

-- 10. Grant necessary permissions (adjust roles as needed)
GRANT ALL ON student_discounts TO authenticated;
GRANT ALL ON discount_summary TO authenticated;

-- Add RLS policies for student_discounts
ALTER TABLE student_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view discounts for their school" ON student_discounts
    FOR SELECT USING (
        class_id IN (
            SELECT id FROM classes 
            WHERE school_id = (
                SELECT school_id FROM user_profiles 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can manage discounts" ON student_discounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
            AND school_id = (
                SELECT school_id FROM classes 
                WHERE id = student_discounts.class_id
            )
        )
    );

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Student discount system created successfully!';
    RAISE NOTICE 'Tables created: student_discounts';
    RAISE NOTICE 'Functions created: calculate_student_fee, apply_discount_to_fee_structure, get_students_with_discounts';
    RAISE NOTICE 'View created: discount_summary';
    RAISE NOTICE 'Triggers created: student_discount_trigger';
END $$;
