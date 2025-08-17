-- School Expense Management System Database Schema
-- Run this SQL script in your Supabase SQL editor

-- Create school_expenses table for tracking all school expenses
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

-- Create expense_categories table for predefined categories with budgets
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

-- Create expense_budgets table for monthly/yearly budget tracking
CREATE TABLE IF NOT EXISTS public.expense_budgets (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES public.expense_categories(id) ON DELETE CASCADE,
    budget_year INTEGER NOT NULL,
    budget_month INTEGER CHECK (budget_month >= 1 AND budget_month <= 12),
    budget_amount DECIMAL(12, 2) NOT NULL CHECK (budget_amount >= 0),
    budget_type VARCHAR(20) NOT NULL CHECK (budget_type IN ('monthly', 'yearly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_id, budget_year, budget_month, budget_type)
);

-- Create expense_approvals table for approval workflow (optional)
CREATE TABLE IF NOT EXISTS public.expense_approvals (
    id BIGSERIAL PRIMARY KEY,
    expense_id BIGINT REFERENCES public.school_expenses(id) ON DELETE CASCADE,
    approver_id VARCHAR(100) NOT NULL,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approval_notes TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_school_expenses_date ON public.school_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_school_expenses_category ON public.school_expenses(category);
CREATE INDEX IF NOT EXISTS idx_school_expenses_created_at ON public.school_expenses(created_at);
CREATE INDEX IF NOT EXISTS idx_expense_categories_active ON public.expense_categories(is_active);

-- Add foreign key constraint to link expenses with categories
-- Note: We'll use category name as foreign key for simplicity
-- In production, you might want to use category_id instead

-- Create trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Apply the trigger to tables
CREATE TRIGGER update_school_expenses_updated_at BEFORE UPDATE ON public.school_expenses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_expense_categories_updated_at BEFORE UPDATE ON public.expense_categories FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_expense_budgets_updated_at BEFORE UPDATE ON public.expense_budgets FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security (RLS) for security
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your authentication setup)
-- Allow authenticated users to read all expenses
CREATE POLICY "Enable read for authenticated users" ON public.school_expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for authenticated users" ON public.expense_categories FOR SELECT USING (auth.role() = 'authenticated');

-- Allow admin users to insert/update/delete expenses
CREATE POLICY "Enable insert for admin users" ON public.school_expenses FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for admin users" ON public.school_expenses FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for admin users" ON public.school_expenses FOR DELETE USING (auth.role() = 'authenticated');

-- Create a view for expense summary by category
CREATE OR REPLACE VIEW public.expense_summary_by_category AS
SELECT 
    e.category,
    ec.icon,
    ec.color,
    ec.monthly_budget,
    ec.yearly_budget,
    COUNT(e.id) as transaction_count,
    SUM(e.amount) as total_amount,
    AVG(e.amount) as average_amount,
    MIN(e.expense_date) as first_expense_date,
    MAX(e.expense_date) as latest_expense_date
FROM public.school_expenses e
LEFT JOIN public.expense_categories ec ON e.category = ec.name
GROUP BY e.category, ec.icon, ec.color, ec.monthly_budget, ec.yearly_budget
ORDER BY total_amount DESC;

-- Create a view for monthly expense summary
CREATE OR REPLACE VIEW public.monthly_expense_summary AS
SELECT 
    EXTRACT(YEAR FROM expense_date) as year,
    EXTRACT(MONTH FROM expense_date) as month,
    category,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM public.school_expenses
GROUP BY EXTRACT(YEAR FROM expense_date), EXTRACT(MONTH FROM expense_date), category
ORDER BY year DESC, month DESC, total_amount DESC;

-- Create a function to get expense statistics
CREATE OR REPLACE FUNCTION get_expense_stats(start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days', end_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_expenses DECIMAL(12,2),
    transaction_count BIGINT,
    average_expense DECIMAL(12,2),
    top_category TEXT,
    top_category_amount DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH expense_stats AS (
        SELECT 
            COALESCE(SUM(amount), 0) as total_exp,
            COUNT(*) as trans_count,
            COALESCE(AVG(amount), 0) as avg_exp
        FROM public.school_expenses
        WHERE expense_date BETWEEN start_date AND end_date
    ),
    top_cat AS (
        SELECT 
            category as cat_name,
            SUM(amount) as cat_amount
        FROM public.school_expenses
        WHERE expense_date BETWEEN start_date AND end_date
        GROUP BY category
        ORDER BY SUM(amount) DESC
        LIMIT 1
    )
    SELECT 
        es.total_exp,
        es.trans_count,
        es.avg_exp,
        COALESCE(tc.cat_name, 'No expenses'),
        COALESCE(tc.cat_amount, 0)
    FROM expense_stats es
    LEFT JOIN top_cat tc ON TRUE;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your setup)
-- GRANT ALL ON public.school_expenses TO authenticated;
-- GRANT ALL ON public.expense_categories TO authenticated;
-- GRANT ALL ON public.expense_budgets TO authenticated;
-- GRANT ALL ON public.expense_approvals TO authenticated;

-- Insert some sample data for testing (optional)
INSERT INTO public.school_expenses (title, amount, category, description, expense_date, receipt_number, vendor) VALUES
('Monthly Teacher Salaries - December', 450000, 'Staff Salaries', 'Salary payment for all teaching staff', '2024-12-01', 'SAL-2024-12-001', 'Payroll Department'),
('Electricity Bill - November', 35000, 'Utilities', 'Monthly electricity consumption', '2024-11-28', 'EB-NOV-2024', 'State Electricity Board'),
('Science Lab Equipment', 85000, 'Supplies & Materials', 'Microscopes and lab apparatus', '2024-11-25', 'LAB-2024-11-001', 'Scientific Instruments Ltd'),
('Playground Maintenance', 45000, 'Infrastructure', 'Repair and maintenance of playground equipment', '2024-11-20', 'MAINT-2024-11-003', 'ABC Contractors'),
('School Bus Fuel', 25000, 'Transportation', 'Monthly fuel expenses for school buses', '2024-11-15', 'FUEL-NOV-2024', 'XYZ Petrol Pump');

-- Success message
SELECT 'School expense management database schema created successfully!' as status;
