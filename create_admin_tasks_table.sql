-- Create admin_tasks table for tasks assigned by admin to teachers
-- This table stores tasks that administrators assign to teachers

CREATE TABLE admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Admin who assigned the task
    assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Teacher who receives the task
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'general',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional fields for admin tasks
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    requires_response BOOLEAN DEFAULT FALSE,
    response_text TEXT,
    response_submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT admin_tasks_type_check CHECK (task_type IN ('attendance', 'marks', 'homework', 'meeting', 'report', 'planning', 'general', 'administrative')),
    CONSTRAINT admin_tasks_priority_check CHECK (priority IN ('high', 'medium', 'low')),
    CONSTRAINT admin_tasks_status_check CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue'))
);

-- Create indexes for better performance
CREATE INDEX idx_admin_tasks_assigned_to ON admin_tasks(assigned_to);
CREATE INDEX idx_admin_tasks_assigned_by ON admin_tasks(assigned_by);
CREATE INDEX idx_admin_tasks_school_id ON admin_tasks(school_id);
CREATE INDEX idx_admin_tasks_status ON admin_tasks(status);
CREATE INDEX idx_admin_tasks_priority ON admin_tasks(priority);
CREATE INDEX idx_admin_tasks_due_date ON admin_tasks(due_date);
CREATE INDEX idx_admin_tasks_assigned_at ON admin_tasks(assigned_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_admin_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_admin_tasks_updated_at
    BEFORE UPDATE ON admin_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_tasks_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Teachers can see tasks assigned to them
CREATE POLICY admin_tasks_teacher_view_policy ON admin_tasks
    FOR SELECT USING (assigned_to = auth.uid());

-- Policy: Admins can see all tasks they assigned
CREATE POLICY admin_tasks_admin_view_policy ON admin_tasks
    FOR SELECT USING (assigned_by = auth.uid());

-- Policy: Only admins can insert tasks
CREATE POLICY admin_tasks_insert_policy ON admin_tasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() AND r.role_name = 'admin'
        )
    );

-- Policy: Teachers can update status and response for their assigned tasks
CREATE POLICY admin_tasks_teacher_update_policy ON admin_tasks
    FOR UPDATE USING (assigned_to = auth.uid())
    WITH CHECK (assigned_to = auth.uid());

-- Policy: Admins can update tasks they assigned
CREATE POLICY admin_tasks_admin_update_policy ON admin_tasks
    FOR UPDATE USING (assigned_by = auth.uid())
    WITH CHECK (assigned_by = auth.uid());

-- Policy: Only admins can delete tasks they assigned
CREATE POLICY admin_tasks_delete_policy ON admin_tasks
    FOR DELETE USING (assigned_by = auth.uid());

-- Create a view for teachers to see their assigned tasks with admin info
CREATE VIEW teacher_assigned_tasks AS
SELECT 
    at.*,
    admin_user.full_name as assigned_by_name,
    admin_user.email as assigned_by_email
FROM admin_tasks at
JOIN users admin_user ON at.assigned_by = admin_user.id
WHERE at.assigned_to = auth.uid();

-- Grant permissions
GRANT ALL ON admin_tasks TO authenticated;
GRANT SELECT ON teacher_assigned_tasks TO authenticated;

-- Insert some sample data for testing (optional)
-- Note: Replace the user IDs with actual user IDs from your users table
/*
INSERT INTO admin_tasks (assigned_by, assigned_to, task_title, task_description, task_type, priority, due_date, requires_response) VALUES
    ('admin-user-id-here', 'teacher-user-id-here', 'Submit Monthly Attendance Report', 'Please compile and submit the monthly attendance report for all your classes by the due date.', 'report', 'high', '2025-08-15', true),
    ('admin-user-id-here', 'teacher-user-id-here', 'Update Student Grades', 'Update all student grades in the system for the current semester.', 'marks', 'medium', '2025-08-12', false),
    ('admin-user-id-here', 'teacher-user-id-here', 'Attend Faculty Meeting', 'Mandatory faculty meeting to discuss curriculum changes.', 'meeting', 'high', '2025-08-10', false);
*/

-- Comments for documentation
COMMENT ON TABLE admin_tasks IS 'Stores tasks assigned by administrators to teachers';
COMMENT ON COLUMN admin_tasks.assigned_by IS 'Admin user who assigned the task';
COMMENT ON COLUMN admin_tasks.assigned_to IS 'Teacher user who receives the task';
COMMENT ON COLUMN admin_tasks.requires_response IS 'Whether the task requires a written response from the teacher';
COMMENT ON COLUMN admin_tasks.response_text IS 'Teacher response to the task (if required)';
COMMENT ON COLUMN admin_tasks.task_type IS 'Type of task: attendance, marks, homework, meeting, report, planning, general, administrative';
COMMENT ON COLUMN admin_tasks.priority IS 'Task priority level: high, medium, low';
COMMENT ON COLUMN admin_tasks.status IS 'Current status: pending, in_progress, completed, cancelled, overdue';
