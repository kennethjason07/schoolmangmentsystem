-- Create personal_tasks table for teacher dashboard task management
-- This table stores personal tasks created by teachers for their own organization

CREATE TABLE personal_tasks (
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
    
    -- Constraints
    CONSTRAINT personal_tasks_type_check CHECK (task_type IN ('attendance', 'marks', 'homework', 'meeting', 'report', 'planning', 'general')),
    CONSTRAINT personal_tasks_priority_check CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT personal_tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Create indexes for better performance
CREATE INDEX idx_personal_tasks_user_id ON personal_tasks(user_id);
CREATE INDEX idx_personal_tasks_status ON personal_tasks(status);
CREATE INDEX idx_personal_tasks_priority ON personal_tasks(priority);
CREATE INDEX idx_personal_tasks_due_date ON personal_tasks(due_date);
CREATE INDEX idx_personal_tasks_created_at ON personal_tasks(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_personal_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_personal_tasks_updated_at
    BEFORE UPDATE ON personal_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_personal_tasks_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE personal_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own tasks
CREATE POLICY personal_tasks_user_policy ON personal_tasks
    FOR ALL USING (user_id = auth.uid());

-- Policy: Users can insert their own tasks
CREATE POLICY personal_tasks_insert_policy ON personal_tasks
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own tasks
CREATE POLICY personal_tasks_update_policy ON personal_tasks
    FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can delete their own tasks
CREATE POLICY personal_tasks_delete_policy ON personal_tasks
    FOR DELETE USING (user_id = auth.uid());

-- Insert some sample data for testing (optional)
-- Note: Replace the user_id with actual user IDs from your users table
/*
INSERT INTO personal_tasks (user_id, task_title, task_description, task_type, priority, due_date) VALUES
    ('your-teacher-user-id-here', 'Submit monthly attendance report', 'Compile and submit the monthly attendance report for all classes', 'report', 'high', '2025-08-15'),
    ('your-teacher-user-id-here', 'Prepare lesson plans for next week', 'Create detailed lesson plans for Mathematics Grade 10', 'planning', 'medium', '2025-08-10'),
    ('your-teacher-user-id-here', 'Grade homework assignments', 'Grade the homework assignments submitted by students', 'marks', 'medium', '2025-08-08'),
    ('your-teacher-user-id-here', 'Parent-teacher meeting preparation', 'Prepare materials and notes for upcoming parent-teacher meetings', 'meeting', 'low', '2025-08-20');
*/

-- Grant necessary permissions (adjust based on your app's user roles)
GRANT ALL ON personal_tasks TO authenticated;
GRANT USAGE ON SEQUENCE personal_tasks_id_seq TO authenticated;

-- Comments for documentation
COMMENT ON TABLE personal_tasks IS 'Stores personal tasks created by teachers for their own task management and organization';
COMMENT ON COLUMN personal_tasks.task_type IS 'Type of task: attendance, marks, homework, meeting, report, planning, general';
COMMENT ON COLUMN personal_tasks.priority IS 'Task priority level: high, medium, low';
COMMENT ON COLUMN personal_tasks.status IS 'Current status: pending, in_progress, completed, cancelled';
COMMENT ON COLUMN personal_tasks.due_date IS 'Date when the task is due to be completed';
COMMENT ON COLUMN personal_tasks.completed_at IS 'Timestamp when the task was marked as completed';
