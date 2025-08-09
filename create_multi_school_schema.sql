-- Multi-School Database Schema Creation
-- Run this in your Supabase SQL Editor FIRST

-- 1. Create schools table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    school_code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(50) DEFAULT 'Primary',
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    established_date DATE,
    principal_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create school_users junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS school_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    role_in_school VARCHAR(50) NOT NULL DEFAULT 'Student',
    is_primary_school BOOLEAN DEFAULT false,
    joined_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, school_id)
);

-- 3. Add school_id to existing tables (if they don't have it already)

-- Check if students table exists and add school_id if needed
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'students') THEN
        -- Add school_id column if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'school_id'
        ) THEN
            ALTER TABLE students ADD COLUMN school_id UUID REFERENCES schools(id);
            CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
        END IF;
    END IF;
END $$;

-- Check if classes table exists and add school_id if needed
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'classes') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'classes' AND column_name = 'school_id'
        ) THEN
            ALTER TABLE classes ADD COLUMN school_id UUID REFERENCES schools(id);
            CREATE INDEX IF NOT EXISTS idx_classes_school_id ON classes(school_id);
        END IF;
    END IF;
END $$;

-- Check if users table exists and add school_id if needed
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'school_id'
        ) THEN
            ALTER TABLE users ADD COLUMN school_id UUID REFERENCES schools(id);
            CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
        END IF;
    END IF;
END $$;

-- Add school_id to other common tables if they exist
DO $$
DECLARE
    table_names TEXT[] := ARRAY['subjects', 'student_attendance', 'teacher_attendance', 'marks', 'assignments', 'announcements', 'events', 'fee_records', 'library_books', 'library_transactions'];
    current_table TEXT;
BEGIN
    FOREACH current_table IN ARRAY table_names
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = current_table) THEN
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = current_table AND column_name = 'school_id'
            ) THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN school_id UUID REFERENCES schools(id)', current_table);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_school_id ON %I(school_id)', current_table, current_table);
            END IF;
        END IF;
    END LOOP;
END $$;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(school_code);
CREATE INDEX IF NOT EXISTS idx_school_users_user_id ON school_users(user_id);
CREATE INDEX IF NOT EXISTS idx_school_users_school_id ON school_users(school_id);
CREATE INDEX IF NOT EXISTS idx_school_users_primary ON school_users(user_id, is_primary_school);

-- 5. Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Add updated_at triggers
CREATE TRIGGER update_schools_updated_at 
    BEFORE UPDATE ON schools 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_school_users_updated_at 
    BEFORE UPDATE ON school_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable Row Level Security (RLS)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_users ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies for schools
CREATE POLICY "Users can view schools they belong to" ON schools
    FOR SELECT USING (
        id IN (
            SELECT school_id FROM school_users 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage their schools" ON schools
    FOR ALL USING (
        id IN (
            SELECT school_id FROM school_users 
            WHERE user_id = auth.uid() 
            AND role_in_school = 'Admin' 
            AND is_active = true
        )
    );

-- 9. Create RLS policies for school_users
CREATE POLICY "Users can view their school memberships" ON school_users
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage school memberships" ON school_users
    FOR ALL USING (
        school_id IN (
            SELECT school_id FROM school_users 
            WHERE user_id = auth.uid() 
            AND role_in_school = 'Admin' 
            AND is_active = true
        )
    );

-- 10. Insert default Maximus school
INSERT INTO schools (name, school_code, type, is_active, address, phone, email)
VALUES (
    'Maximus', 
    'MAX001', 
    'Primary', 
    true, 
    'Maximus School Address', 
    '1234567890', 
    'admin@maximus.edu'
) ON CONFLICT (school_code) DO NOTHING;

-- 11. Show summary
SELECT 
    'Schema created successfully!' as status,
    COUNT(*) as schools_count
FROM schools WHERE name = 'Maximus';

-- 12. Show existing tables that now have school_id
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE column_name = 'school_id' 
AND table_schema = 'public'
ORDER BY table_name;
