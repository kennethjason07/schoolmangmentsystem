-- =====================================================
-- SIMPLIFIED EXPENSE MANAGEMENT TABLES FOR SUPABASE
-- Copy and paste this into your Supabase SQL Editor
-- =====================================================

-- 1. Main school_expenses table (simplified)
CREATE TABLE IF NOT EXISTS public.school_expenses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Expense categories table (simplified)
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    monthly_budget DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert default expense categories (simplified)
INSERT INTO public.expense_categories (name, monthly_budget) VALUES
('Staff Salaries', 500000),
('Utilities', 50000),
('Supplies & Materials', 100000),
('Infrastructure', 200000),
('Transportation', 75000),
('Food & Catering', 80000),
('Events & Activities', 50000),
('Technology', 100000),
('Marketing', 30000),
('Miscellaneous', 50000);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_school_expenses_date ON public.school_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_school_expenses_category ON public.school_expenses(category);
CREATE INDEX IF NOT EXISTS idx_school_expenses_created_at ON public.school_expenses(created_at);

-- 5. Insert some sample data for testing
INSERT INTO public.school_expenses (title, amount, category, description, expense_date) VALUES
('Monthly Teacher Salaries - December', 450000, 'Staff Salaries', 'Salary payment for all teaching staff', '2024-12-01'),
('Electricity Bill - November', 35000, 'Utilities', 'Monthly electricity consumption', '2024-11-28'),
('Science Lab Equipment', 85000, 'Supplies & Materials', 'Microscopes and lab apparatus', '2024-11-25'),
('Playground Maintenance', 45000, 'Infrastructure', 'Repair and maintenance of playground equipment', '2024-11-20'),
('School Bus Fuel', 25000, 'Transportation', 'Monthly fuel expenses for school buses', '2024-11-15'),
('Computer Lab Software', 75000, 'Technology', 'Annual software licenses', '2024-11-10'),
('Sports Equipment', 30000, 'Events & Activities', 'Football, basketball equipment', '2024-11-05'),
('Cafeteria Supplies', 40000, 'Food & Catering', 'Monthly food supplies', '2024-11-03'),
('Internet Bill - November', 15000, 'Utilities', 'Monthly internet charges', '2024-11-01'),
('Office Stationery', 8000, 'Supplies & Materials', 'Pens, papers, folders', '2024-10-28');

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- 7. Create security policies
-- Allow authenticated users to perform all operations
CREATE POLICY "Allow authenticated users full access to expenses" ON public.school_expenses
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read expense categories" ON public.expense_categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage expense categories (optional)
CREATE POLICY "Allow authenticated users to manage expense categories" ON public.expense_categories
    FOR ALL USING (auth.role() = 'authenticated');

-- 8. Create a useful view for expense summary
CREATE OR REPLACE VIEW public.expense_summary_by_category AS
SELECT 
    e.category,
    ec.monthly_budget,
    COUNT(e.id) as transaction_count,
    SUM(e.amount) as total_amount,
    AVG(e.amount) as average_amount,
    MIN(e.expense_date) as first_expense_date,
    MAX(e.expense_date) as latest_expense_date,
    CASE 
        WHEN ec.monthly_budget > 0 THEN 
            ROUND((SUM(e.amount) / ec.monthly_budget * 100)::numeric, 2)
        ELSE 0 
    END as budget_usage_percentage
FROM public.school_expenses e
LEFT JOIN public.expense_categories ec ON e.category = ec.name
GROUP BY e.category, ec.monthly_budget
ORDER BY total_amount DESC;

-- 9. Success message
SELECT 'Expense management tables created successfully! 🎉' as status,
       'Tables: school_expenses, expense_categories' as tables_created,
       'Sample data inserted for testing' as sample_data;
