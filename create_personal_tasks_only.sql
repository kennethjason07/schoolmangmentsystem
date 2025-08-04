-- Create only personal_tasks table (tasks table already exists)
-- This script creates the personal_tasks table and enhances the existing tasks table

-- =====================================================
-- 1. CREATE PERSONAL TASKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS personal_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT personal_tasks_type_check CHECK (task_type IN ('attendance', 'marks', 'homework', 'meeting', 'report', 'planning', 'general')),
    CONSTRAINT personal_tasks_priority_check CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT personal_tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- =====================================================
-- 2. ENHANCE EXISTING TASKS TABLE
-- =====================================================

-- Add task_type column to existing tasks table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'task_type') THEN
        ALTER TABLE tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'general';
        ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (task_type IN ('attendance', 'marks', 'homework', 'meeting', 'report', 'planning', 'general', 'administrative'));
    END IF;
END $$;

-- Add completed_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'completed_at') THEN
        ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- =====================================================
-- 3. CREATE INDEXES
-- =====================================================

-- Personal Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_id ON personal_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_status ON personal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_priority ON personal_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_due_date ON personal_tasks(due_date);

-- Additional indexes for existing tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_teacher_ids ON tasks USING GIN(assigned_teacher_ids);

-- =====================================================
-- 4. CREATE TRIGGERS
-- =====================================================

-- Personal Tasks Trigger
CREATE OR REPLACE FUNCTION update_personal_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_personal_tasks_updated_at ON personal_tasks;
CREATE TRIGGER trigger_update_personal_tasks_updated_at
    BEFORE UPDATE ON personal_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_personal_tasks_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS for personal_tasks
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- Personal Tasks Policies
DROP POLICY IF EXISTS personal_tasks_user_policy ON personal_tasks;
CREATE POLICY personal_tasks_user_policy ON personal_tasks
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON personal_tasks TO authenticated;

-- =====================================================
-- 7. SAMPLE DATA (OPTIONAL)
-- =====================================================

/*
-- Sample Personal Tasks (replace 'your-teacher-user-id' with actual user ID)
INSERT INTO personal_tasks (user_id, task_title, task_description, task_type, priority, due_date) VALUES
    ('your-teacher-user-id', 'Prepare lesson plans', 'Create detailed lesson plans for next week', 'planning', 'medium', '2025-08-10'),
    ('your-teacher-user-id', 'Grade assignments', 'Grade the latest homework assignments', 'marks', 'high', '2025-08-08'),
    ('your-teacher-user-id', 'Update attendance', 'Update student attendance records', 'attendance', 'medium', '2025-08-05');

-- Sample Admin Tasks using existing tasks table (replace user IDs with actual values)
INSERT INTO tasks (title, description, task_type, priority, due_date, assigned_teacher_ids) VALUES
    ('Submit monthly report', 'Submit the monthly attendance and performance report', 'report', 'High', '2025-08-15', ARRAY['teacher-user-id-1']),
    ('Faculty meeting', 'Attend the monthly faculty meeting', 'meeting', 'Medium', '2025-08-12', ARRAY['teacher-user-id-1']);
*/

-- Comments for documentation
COMMENT ON TABLE personal_tasks IS 'Stores personal tasks created by teachers for their own task management';
COMMENT ON COLUMN personal_tasks.task_type IS 'Type of task: attendance, marks, homework, meeting, report, planning, general';
COMMENT ON COLUMN personal_tasks.priority IS 'Task priority level: high, medium, low';
COMMENT ON COLUMN personal_tasks.status IS 'Current status: pending, in_progress, completed, cancelled';
