-- Add missing columns to existing expense_categories table
-- This script safely adds the missing columns without affecting existing data

-- Add missing color column
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#2196F3';

-- Add missing icon column
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'briefcase';

-- Add missing updated_at column
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update existing rows with proper default values for each category
UPDATE public.expense_categories 
SET 
    icon = CASE 
        WHEN name = 'Staff Salaries' THEN 'people'
        WHEN name = 'Utilities' THEN 'flash'
        WHEN name = 'Supplies & Materials' THEN 'library'
        WHEN name = 'Infrastructure' THEN 'build'
        WHEN name = 'Transportation' THEN 'car'
        WHEN name = 'Food & Catering' THEN 'restaurant'
        WHEN name = 'Events & Activities' THEN 'calendar'
        WHEN name = 'Technology' THEN 'desktop'
        WHEN name = 'Marketing' THEN 'megaphone'
        WHEN name = 'Miscellaneous' THEN 'ellipsis-horizontal'
        ELSE 'briefcase'
    END,
    color = CASE 
        WHEN name = 'Staff Salaries' THEN '#2196F3'
        WHEN name = 'Utilities' THEN '#FF9800'
        WHEN name = 'Supplies & Materials' THEN '#4CAF50'
        WHEN name = 'Infrastructure' THEN '#9C27B0'
        WHEN name = 'Transportation' THEN '#F44336'
        WHEN name = 'Food & Catering' THEN '#FF5722'
        WHEN name = 'Events & Activities' THEN '#607D8B'
        WHEN name = 'Technology' THEN '#795548'
        WHEN name = 'Marketing' THEN '#E91E63'
        WHEN name = 'Miscellaneous' THEN '#009688'
        ELSE '#2196F3'
    END,
    updated_at = now()
WHERE icon IS NULL OR color IS NULL;

-- Create trigger function for updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger for automatic updated_at updates
DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON public.expense_categories;
CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON public.expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert missing default categories if they don't exist
INSERT INTO public.expense_categories (name, icon, color, monthly_budget, created_at, updated_at)
SELECT name, icon, color, monthly_budget, now(), now()
FROM (VALUES 
    ('Staff Salaries', 'people', '#2196F3', 500000),
    ('Utilities', 'flash', '#FF9800', 50000),
    ('Supplies & Materials', 'library', '#4CAF50', 100000),
    ('Infrastructure', 'build', '#9C27B0', 200000),
    ('Transportation', 'car', '#F44336', 75000),
    ('Food & Catering', 'restaurant', '#FF5722', 80000),
    ('Events & Activities', 'calendar', '#607D8B', 50000),
    ('Technology', 'desktop', '#795548', 100000),
    ('Marketing', 'megaphone', '#E91E63', 30000),
    ('Miscellaneous', 'ellipsis-horizontal', '#009688', 50000)
) AS default_categories(name, icon, color, monthly_budget)
WHERE NOT EXISTS (
    SELECT 1 FROM public.expense_categories 
    WHERE expense_categories.name = default_categories.name
);

-- Verify the updated table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'expense_categories' 
ORDER BY ordinal_position;

-- Show all categories with their new columns
SELECT id, name, icon, color, monthly_budget FROM public.expense_categories ORDER BY name;

-- Success message
SELECT '✅ expense_categories table updated successfully! Added color and icon columns.' as status;
