-- Create notifications table for storing grade notifications
-- This will store notifications when teachers add marks for students
-- Based on existing table structure with proper relationships

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who is this notification for (parent user)
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- What student is this about
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL DEFAULT 'grade_update',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Additional data (JSON for flexibility - marks, class info, etc.)
    data JSONB,
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT notifications_type_check CHECK (notification_type IN ('grade_update', 'attendance', 'homework', 'announcement', 'general'))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notifications_updated_at
    BEFORE UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_notifications_updated_at();

-- Add RLS (Row Level Security) policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can only see notifications for their own account
CREATE POLICY notifications_parent_policy ON notifications
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Parents can update read status of their own notifications
CREATE POLICY notifications_parent_update_policy ON notifications
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Policy: Only authenticated users (teachers/admins) can insert notifications
CREATE POLICY notifications_insert_policy ON notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = auth.uid() AND r.role_name IN ('teacher', 'admin')
        )
    );

-- Grant permissions
GRANT ALL ON notifications TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores notifications for parents about their children (grades, attendance, etc.)';
COMMENT ON COLUMN notifications.user_id IS 'Parent user who will receive this notification';
COMMENT ON COLUMN notifications.student_id IS 'Student this notification is about';
COMMENT ON COLUMN notifications.notification_type IS 'Type of notification: grade_update, attendance, homework, announcement, general';
COMMENT ON COLUMN notifications.title IS 'Short title/subject of the notification';
COMMENT ON COLUMN notifications.message IS 'Full notification message content';
COMMENT ON COLUMN notifications.data IS 'Additional structured data (marks, class info, etc.) in JSON format';
COMMENT ON COLUMN notifications.is_read IS 'Whether the parent has read this notification';
COMMENT ON COLUMN notifications.read_at IS 'When the notification was marked as read';
