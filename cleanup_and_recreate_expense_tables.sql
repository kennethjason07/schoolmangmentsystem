-- =====================================================
-- CLEANUP AND RECREATE EXPENSE MANAGEMENT TABLES
-- ⚠️  WARNING: This will delete ALL existing expense data!
-- Copy and paste this into your Supabase SQL Editor
-- =====================================================

-- 1. Drop existing policies first (to avoid dependency issues)
DROP POLICY IF EXISTS "Allow authenticated users full access to expenses" ON public.school_expenses;
DROP POLICY IF EXISTS "Allow authenticated users to read expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Allow authenticated users to manage expense categories" ON public.expense_categories;

-- 2. Drop existing views
DROP VIEW IF EXISTS public.expense_summary_by_category;

-- 3. Drop existing tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS public.school_expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;

-- 4. Drop any existing functions/triggers (cleanup)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 5. Success message for cleanup
SELECT '🗑️ Old tables and policies dropped successfully!' as cleanup_status;

-- =====================================================
-- NOW RECREATE WITH SIMPLIFIED SCHEMA
-- =====================================================

-- 6. Main school_expenses table (simplified)
CREATE TABLE IF NOT EXISTS public.school_expenses (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Expense categories table (simplified)
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    monthly_budget DECIMAL(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Insert default expense categories (simplified)
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

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_school_expenses_date ON public.school_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_school_expenses_category ON public.school_expenses(category);
CREATE INDEX IF NOT EXISTS idx_school_expenses_created_at ON public.school_expenses(created_at);

-- 10. Insert some sample data for testing
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

-- 11. Enable Row Level Security (RLS)
ALTER TABLE public.school_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- 12. Create security policies
-- Allow authenticated users to perform all operations
CREATE POLICY "Allow authenticated users full access to expenses" ON public.school_expenses
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read expense categories" ON public.expense_categories
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage expense categories (optional)
CREATE POLICY "Allow authenticated users to manage expense categories" ON public.expense_categories
    FOR ALL USING (auth.role() = 'authenticated');

-- 13. Create a useful view for expense summary
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

-- 14. Final success message
SELECT '✅ Expense management tables recreated successfully! 🎉' as status,
       'Tables: school_expenses, expense_categories (SIMPLIFIED)' as tables_created,
       'Sample data inserted for testing' as sample_data,
       '⚠️ All old data has been replaced with new schema' as warning;
