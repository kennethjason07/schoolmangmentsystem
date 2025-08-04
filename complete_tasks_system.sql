-- Complete Task Management System for Teacher Dashboard
-- Run this script to create personal_tasks table and enhance existing tasks table
-- Note: The 'tasks' table already exists for admin tasks, we'll use it as-is

-- =====================================================
-- 1. PERSONAL TASKS TABLE (NEW)
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
-- 2. ENHANCE EXISTING TASKS TABLE (ADMIN TASKS)
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
-- 3. INDEXES FOR PERFORMANCE
-- =====================================================

-- Personal Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_personal_tasks_user_id ON personal_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_status ON personal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_priority ON personal_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_personal_tasks_due_date ON personal_tasks(due_date);

-- Existing Tasks Table Indexes (if not already present)
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_teacher_ids ON tasks USING GIN(assigned_teacher_ids);

-- =====================================================
-- 4. TRIGGERS FOR UPDATED_AT
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

-- Tasks Table Trigger (if not already exists)
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_tasks_updated_at();

-- =====================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- Personal Tasks Policies
DROP POLICY IF EXISTS personal_tasks_user_policy ON personal_tasks;
CREATE POLICY personal_tasks_user_policy ON personal_tasks
    FOR ALL USING (user_id = auth.uid());

-- Tasks Table Policies (for existing tasks table)
-- Note: Only add if RLS is not already enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tasks' AND policyname = 'tasks_teacher_view_policy') THEN
        ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

        -- Teachers can view tasks assigned to them
        CREATE POLICY tasks_teacher_view_policy ON tasks
            FOR SELECT USING (auth.uid() = ANY(assigned_teacher_ids));

        -- Teachers can update status of tasks assigned to them
        CREATE POLICY tasks_teacher_update_policy ON tasks
            FOR UPDATE USING (auth.uid() = ANY(assigned_teacher_ids));
    END IF;
END $$;

-- =====================================================
-- 6. UTILITY FUNCTIONS
-- =====================================================

-- Function to get teacher's pending tasks count
CREATE OR REPLACE FUNCTION get_teacher_pending_tasks_count(teacher_user_id UUID)
RETURNS JSON AS $$
DECLARE
    personal_count INTEGER;
    admin_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO personal_count
    FROM personal_tasks
    WHERE user_id = teacher_user_id AND status = 'pending';

    SELECT COUNT(*) INTO admin_count
    FROM tasks
    WHERE teacher_user_id = ANY(assigned_teacher_ids) AND status = 'Pending';

    RETURN json_build_object(
        'personal_tasks', personal_count,
        'admin_tasks', admin_count,
        'total_tasks', personal_count + admin_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark personal task as completed
CREATE OR REPLACE FUNCTION complete_personal_task(task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE personal_tasks
    SET status = 'completed', completed_at = NOW()
    WHERE id = task_id AND user_id = auth.uid();

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark admin task as completed
CREATE OR REPLACE FUNCTION complete_admin_task(task_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tasks
    SET status = 'Completed', completed_at = NOW()
    WHERE id = task_id AND auth.uid() = ANY(assigned_teacher_ids);

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON personal_tasks TO authenticated;
GRANT ALL ON tasks TO authenticated; -- Existing table
GRANT EXECUTE ON FUNCTION get_teacher_pending_tasks_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_personal_task(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_admin_task(UUID) TO authenticated;

-- =====================================================
-- 8. SAMPLE DATA (OPTIONAL - UNCOMMENT TO USE)
-- =====================================================

/*
-- Sample Personal Tasks (replace 'your-teacher-user-id' with actual user ID)
INSERT INTO personal_tasks (user_id, task_title, task_description, task_type, priority, due_date) VALUES
    ('your-teacher-user-id', 'Prepare lesson plans', 'Create detailed lesson plans for next week', 'planning', 'medium', '2025-08-10'),
    ('your-teacher-user-id', 'Grade assignments', 'Grade the latest homework assignments', 'marks', 'high', '2025-08-08'),
    ('your-teacher-user-id', 'Update attendance', 'Update student attendance records', 'attendance', 'medium', '2025-08-05');

-- Sample Admin Tasks using existing tasks table (replace user IDs with actual values)
INSERT INTO tasks (title, description, task_type, priority, due_date, assigned_teacher_ids) VALUES
    ('Submit monthly report', 'Submit the monthly attendance and performance report', 'report', 'High', '2025-08-15', ARRAY['teacher-user-id-1', 'teacher-user-id-2']),
    ('Faculty meeting', 'Attend the monthly faculty meeting', 'meeting', 'Medium', '2025-08-12', ARRAY['teacher-user-id-1']),
    ('Update curriculum', 'Review and update curriculum for next semester', 'planning', 'Low', '2025-08-20', ARRAY['teacher-user-id-1', 'teacher-user-id-2', 'teacher-user-id-3']);
*/
