-- Simplified Stationary Fee Management System
-- Remove inventory tracking and focus on fee collection
-- NO DEFAULT DATA INSERTION - Clean schema only

-- Drop existing tables and recreate with simplified schema
DROP TABLE IF EXISTS stationary_stock_adjustments CASCADE;
DROP TABLE IF EXISTS stationary_purchases CASCADE;
DROP TABLE IF EXISTS stationary_items CASCADE;

-- Simplified stationary items table - only name and fee amount
CREATE TABLE stationary_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    fee_amount DECIMAL(10,2) NOT NULL CHECK (fee_amount >= 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Simplified stationary purchases table - focus on fee payment
CREATE TABLE stationary_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES stationary_items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_mode VARCHAR(50) NOT NULL DEFAULT 'Cash',
    receipt_number VARCHAR(100) UNIQUE,
    academic_year VARCHAR(10),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Ensure total_amount matches quantity * unit_price
    CONSTRAINT check_total_amount CHECK (total_amount = quantity * unit_price)
);

-- Create indexes for better performance
CREATE INDEX idx_stationary_items_tenant ON stationary_items(tenant_id);
CREATE INDEX idx_stationary_items_active ON stationary_items(tenant_id, is_active);
CREATE INDEX idx_stationary_purchases_tenant ON stationary_purchases(tenant_id);
CREATE INDEX idx_stationary_purchases_student ON stationary_purchases(tenant_id, student_id);
CREATE INDEX idx_stationary_purchases_class ON stationary_purchases(tenant_id, class_id);
CREATE INDEX idx_stationary_purchases_date ON stationary_purchases(tenant_id, payment_date);
CREATE INDEX idx_stationary_purchases_receipt ON stationary_purchases(receipt_number);

-- Function to get tenant_id for current user
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT tenant_id 
        FROM users 
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE stationary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stationary_purchases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "stationary_items_tenant_policy" ON stationary_items;
DROP POLICY IF EXISTS "stationary_purchases_tenant_policy" ON stationary_purchases;

-- RLS Policies for stationary_items
CREATE POLICY "stationary_items_tenant_policy" 
ON stationary_items 
FOR ALL 
USING (tenant_id = get_user_tenant_id());

-- RLS Policies for stationary_purchases
CREATE POLICY "stationary_purchases_tenant_policy" 
ON stationary_purchases 
FOR ALL 
USING (tenant_id = get_user_tenant_id());

-- Grant permissions
GRANT ALL ON stationary_items TO authenticated;
GRANT ALL ON stationary_purchases TO authenticated;

-- Function to generate receipt numbers for stationary purchases
CREATE OR REPLACE FUNCTION generate_stationary_receipt_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    tenant_prefix TEXT;
    counter INTEGER;
    current_year TEXT;
BEGIN
    -- Get current academic year (April to March)
    current_year := CASE 
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN 
            EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || '-' || (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::TEXT
        ELSE 
            (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
    END;
    
    -- Get tenant prefix (first 3 characters of tenant name)
    SELECT UPPER(LEFT(name, 3)) INTO tenant_prefix 
    FROM tenants 
    WHERE id = get_user_tenant_id();
    
    -- Get next counter for this tenant and year
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS INTEGER)), 0) + 1 
    INTO counter
    FROM stationary_purchases 
    WHERE tenant_id = get_user_tenant_id() 
    AND receipt_number LIKE tenant_prefix || '-ST-' || current_year || '-%';
    
    -- Generate receipt number: TEN-ST-2024-25-001
    new_number := tenant_prefix || '-ST-' || current_year || '-' || LPAD(counter::TEXT, 3, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate receipt numbers
CREATE OR REPLACE FUNCTION set_stationary_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_number IS NULL THEN
        NEW.receipt_number := generate_stationary_receipt_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS stationary_receipt_number_trigger ON stationary_purchases;

-- Create trigger
CREATE TRIGGER stationary_receipt_number_trigger
    BEFORE INSERT ON stationary_purchases
    FOR EACH ROW
    EXECUTE FUNCTION set_stationary_receipt_number();

-- Update trigger for updated_at on stationary_items
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_stationary_items_updated_at ON stationary_items;

-- Create trigger
CREATE TRIGGER update_stationary_items_updated_at
    BEFORE UPDATE ON stationary_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add current academic year to purchases automatically
CREATE OR REPLACE FUNCTION set_academic_year()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.academic_year IS NULL THEN
        NEW.academic_year := CASE 
            WHEN EXTRACT(MONTH FROM NEW.payment_date) >= 4 THEN 
                EXTRACT(YEAR FROM NEW.payment_date)::TEXT || '-' || (EXTRACT(YEAR FROM NEW.payment_date) + 1)::TEXT
            ELSE 
                (EXTRACT(YEAR FROM NEW.payment_date) - 1)::TEXT || '-' || EXTRACT(YEAR FROM NEW.payment_date)::TEXT
        END;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_academic_year_trigger ON stationary_purchases;

-- Create trigger
CREATE TRIGGER set_academic_year_trigger
    BEFORE INSERT ON stationary_purchases
    FOR EACH ROW
    EXECUTE FUNCTION set_academic_year();

-- Schema is ready. No default data insertion.
-- Items should be added through the application interface.
