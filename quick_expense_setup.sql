-- Quick Expense Management Setup
-- Copy and paste this into your Supabase SQL Editor

-- Create school_expenses table
CREATE TABLE IF NOT EXISTS public.school_expenses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_number VARCHAR(100),
    vendor VARCHAR(255),
    created_by VARCHAR(100) DEFAULT 'admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense_categories table
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    monthly_budget DECIMAL(12, 2) DEFAULT 0,
    yearly_budget DECIMAL(12, 2) DEFAULT 0,
    icon VARCHAR(50) DEFAULT 'receipt',
    color VARCHAR(20) DEFAULT '#2196F3',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description, monthly_budget, yearly_budget, icon, color) VALUES
('Staff Salaries', 'Teacher and staff salary payments', 500000, 6000000, 'people', '#2196F3'),
('Utilities', 'Electricity, water, internet, phone bills', 50000, 600000, 'flash', '#FF9800'),
('Supplies & Materials', 'Books, stationery, lab equipment', 100000, 1200000, 'library', '#4CAF50'),
('Infrastructure', 'Building maintenance, repairs, construction', 200000, 2400000, 'build', '#9C27B0'),
('Transportation', 'School bus, fuel, vehicle maintenance', 75000, 900000, 'car', '#F44336'),
('Food & Catering', 'Cafeteria supplies, student meals', 80000, 960000, 'restaurant', '#FF5722'),
('Events & Activities', 'Sports, cultural events, competitions', 50000, 600000, 'calendar', '#607D8B'),
('Technology', 'Computers, software, IT equipment', 100000, 1200000, 'desktop', '#795548'),
('Marketing', 'Advertising, promotional materials', 30000, 360000, 'megaphone', '#E91E63'),
('Miscellaneous', 'Other miscellaneous expenses', 50000, 600000, 'ellipsis-horizontal', '#009688');

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_expenses_date ON public.school_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_school_expenses_category ON public.school_expenses(category);
CREATE INDEX IF NOT EXISTS idx_school_expenses_created_at ON public.school_expenses(created_at);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply trigger to school_expenses table
CREATE TRIGGER update_school_expenses_updated_at 
BEFORE UPDATE ON public.school_expenses 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Enable read for authenticated users" ON public.school_expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert for authenticated users" ON public.school_expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.school_expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.school_expenses FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users" ON public.expense_categories FOR SELECT USING (auth.role() = 'authenticated');

-- Insert some sample data for testing
INSERT INTO public.school_expenses (title, amount, category, description, expense_date, receipt_number, vendor) VALUES
('Monthly Teacher Salaries - December', 450000, 'Staff Salaries', 'Salary payment for all teaching staff', '2024-12-01', 'SAL-2024-12-001', 'Payroll Department'),
('Electricity Bill - November', 35000, 'Utilities', 'Monthly electricity consumption', '2024-11-28', 'EB-NOV-2024', 'State Electricity Board'),
('Science Lab Equipment', 85000, 'Supplies & Materials', 'Microscopes and lab apparatus', '2024-11-25', 'LAB-2024-11-001', 'Scientific Instruments Ltd'),
('Playground Maintenance', 45000, 'Infrastructure', 'Repair and maintenance of playground equipment', '2024-11-20', 'MAINT-2024-11-003', 'ABC Contractors'),
('School Bus Fuel', 25000, 'Transportation', 'Monthly fuel expenses for school buses', '2024-11-15', 'FUEL-NOV-2024', 'XYZ Petrol Pump');

-- Success message
SELECT 'Expense management tables created successfully! You can now use the expense management system.' as status;
