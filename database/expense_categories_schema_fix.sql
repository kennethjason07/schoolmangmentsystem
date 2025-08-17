-- Fix expense_categories table schema
-- Add missing columns that are required by the application

-- First, let's check if the table exists and what columns it has
-- Run this to see current structure: SELECT * FROM information_schema.columns WHERE table_name = 'expense_categories';

-- Add missing columns to expense_categories table
DO $$ 
BEGIN
    -- Add color column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expense_categories' 
        AND column_name = 'color'
    ) THEN
        ALTER TABLE expense_categories 
        ADD COLUMN color VARCHAR(7) DEFAULT '#2196F3' CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
        
        COMMENT ON COLUMN expense_categories.color IS 'Hex color code for category display (e.g., #2196F3)';
    END IF;

    -- Add icon column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expense_categories' 
        AND column_name = 'icon'
    ) THEN
        ALTER TABLE expense_categories 
        ADD COLUMN icon VARCHAR(50) DEFAULT 'briefcase';
        
        COMMENT ON COLUMN expense_categories.icon IS 'Ionicon name for category display';
    END IF;

    -- Add created_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expense_categories' 
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE expense_categories 
        ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        
        COMMENT ON COLUMN expense_categories.created_at IS 'Timestamp when the category was created';
    END IF;

    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expense_categories' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE expense_categories 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        
        COMMENT ON COLUMN expense_categories.updated_at IS 'Timestamp when the category was last updated';
    END IF;

    -- Ensure monthly_budget column exists and has proper type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'expense_categories' 
        AND column_name = 'monthly_budget'
    ) THEN
        ALTER TABLE expense_categories 
        ADD COLUMN monthly_budget DECIMAL(12,2) DEFAULT 0.00 CHECK (monthly_budget >= 0);
        
        COMMENT ON COLUMN expense_categories.monthly_budget IS 'Monthly budget limit for this category';
    END IF;

END $$;

-- Create or update the updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS update_expense_categories_updated_at ON expense_categories;

CREATE TRIGGER update_expense_categories_updated_at
    BEFORE UPDATE ON expense_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories if the table is empty
INSERT INTO expense_categories (name, icon, color, monthly_budget, created_at, updated_at)
SELECT * FROM (VALUES 
    ('Staff Salaries', 'people', '#2196F3', 500000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Utilities', 'flash', '#FF9800', 50000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Supplies & Materials', 'library', '#4CAF50', 100000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Infrastructure', 'build', '#9C27B0', 200000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Transportation', 'car', '#F44336', 75000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Food & Catering', 'restaurant', '#FF5722', 80000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Events & Activities', 'calendar', '#607D8B', 50000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Technology', 'desktop', '#795548', 100000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Marketing', 'megaphone', '#E91E63', 30000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('Miscellaneous', 'ellipsis-horizontal', '#009688', 50000.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
) AS default_categories(name, icon, color, monthly_budget, created_at, updated_at)
WHERE NOT EXISTS (
    SELECT 1 FROM expense_categories WHERE expense_categories.name = default_categories.name
);

-- Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'expense_categories' 
ORDER BY ordinal_position;

-- Show sample data
SELECT * FROM expense_categories LIMIT 5;
