-- Push Notification System Database Schema

-- Table to store push notification tokens for each user/device
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL, -- 'admin', 'teacher', 'parent', 'student'
  token TEXT NOT NULL, -- Expo push token
  platform TEXT NOT NULL, -- 'ios', 'android', 'web'
  device_info JSONB DEFAULT '{}', -- Device information (name, model, OS version, etc.)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique token per user
  UNIQUE(user_id, token),
  -- Index for faster queries
  INDEX(user_id),
  INDEX(is_active),
  INDEX(platform)
);

-- Table to store user notification preferences
CREATE TABLE IF NOT EXISTS user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Chat message notification settings
  chat_messages BOOLEAN DEFAULT true,
  chat_sound BOOLEAN DEFAULT true,
  chat_vibration BOOLEAN DEFAULT true,
  
  -- Formal notification settings
  formal_notifications BOOLEAN DEFAULT true,
  formal_sound BOOLEAN DEFAULT true,
  formal_vibration BOOLEAN DEFAULT true,
  
  -- Urgent notification settings
  urgent_notifications BOOLEAN DEFAULT true,
  urgent_sound BOOLEAN DEFAULT true,
  urgent_vibration BOOLEAN DEFAULT true,
  
  -- Specific notification type settings
  exam_notifications BOOLEAN DEFAULT true,
  attendance_notifications BOOLEAN DEFAULT true,
  fee_notifications BOOLEAN DEFAULT true,
  assignment_notifications BOOLEAN DEFAULT true,
  announcement_notifications BOOLEAN DEFAULT true,
  
  -- Time-based settings
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00',
  quiet_hours_end TIME DEFAULT '07:00:00',
  
  -- Weekend settings
  weekend_notifications BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one settings record per user
  UNIQUE(user_id),
  INDEX(user_id)
);

-- Table to log push notification delivery attempts and results
CREATE TABLE IF NOT EXISTS push_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id UUID REFERENCES push_tokens(id) ON DELETE SET NULL,
  
  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'chat_message', 'formal_notification', 'urgent'
  notification_data JSONB DEFAULT '{}', -- Additional data sent with notification
  
  -- Delivery information
  delivery_status TEXT NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
  expo_ticket_id TEXT, -- Expo's ticket ID for tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timing
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  INDEX(user_id),
  INDEX(notification_type),
  INDEX(delivery_status),
  INDEX(sent_at)
);

-- Table to track notification read status and interaction
CREATE TABLE IF NOT EXISTS notification_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_log_id UUID REFERENCES push_notification_logs(id) ON DELETE CASCADE,
  
  -- Interaction details
  interaction_type TEXT NOT NULL, -- 'received', 'opened', 'dismissed', 'acted_upon'
  interaction_data JSONB DEFAULT '{}', -- Additional interaction data
  
  -- Timing
  interacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  INDEX(user_id),
  INDEX(notification_log_id),
  INDEX(interaction_type),
  INDEX(interacted_at)
);

-- Table to manage notification queues and scheduling
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification content
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  notification_data JSONB DEFAULT '{}',
  
  -- Scheduling
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  
  -- Processing status
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  
  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  INDEX(user_id),
  INDEX(status),
  INDEX(scheduled_for),
  INDEX(priority)
);

-- Insert default notification settings for existing users
INSERT INTO user_notification_settings (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM user_notification_settings);

-- Function to automatically create notification settings for new users
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_notification_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default notification settings when user is created
DROP TRIGGER IF EXISTS create_notification_settings_on_user_creation ON users;
CREATE TRIGGER create_notification_settings_on_user_creation
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- Function to clean up old push tokens (older than 90 days and inactive)
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_tokens 
  WHERE is_active = false 
    AND updated_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notification logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM push_notification_logs 
  WHERE sent_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active ON push_tokens(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON user_notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type ON push_notification_logs(user_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status_priority ON notification_queue(status, priority, scheduled_for);

-- Row Level Security (RLS) policies for push notification tables

-- Enable RLS on all tables
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Policies for push_tokens
CREATE POLICY "Users can view their own push tokens" ON push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own push tokens" ON push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own push tokens" ON push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- Policies for user_notification_settings
CREATE POLICY "Users can view their own notification settings" ON user_notification_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notification settings" ON user_notification_settings
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notification settings" ON user_notification_settings
  FOR INSERT WITH CHECK (true);

-- Policies for push_notification_logs (read-only for users, full access for system)
CREATE POLICY "Users can view their own notification logs" ON push_notification_logs
  FOR SELECT USING (user_id = auth.uid());

-- Policies for notification_interactions
CREATE POLICY "Users can view their own notification interactions" ON notification_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own notification interactions" ON notification_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policies for notification_queue (system managed)
CREATE POLICY "Users can view their own queued notifications" ON notification_queue
  FOR SELECT USING (user_id = auth.uid());

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_notification_settings TO authenticated;
GRANT SELECT ON push_notification_logs TO authenticated;
GRANT SELECT, INSERT ON notification_interactions TO authenticated;
GRANT SELECT ON notification_queue TO authenticated;

-- Grant system/service role full access (you may need to create a service role)
-- GRANT ALL ON push_tokens TO service_role;
-- GRANT ALL ON user_notification_settings TO service_role;
-- GRANT ALL ON push_notification_logs TO service_role;
-- GRANT ALL ON notification_interactions TO service_role;
-- GRANT ALL ON notification_queue TO service_role;

-- Comments for documentation
COMMENT ON TABLE push_tokens IS 'Stores Expo push notification tokens for each user device';
COMMENT ON TABLE user_notification_settings IS 'User preferences for different types of push notifications';
COMMENT ON TABLE push_notification_logs IS 'Logs all push notification delivery attempts and results';
COMMENT ON TABLE notification_interactions IS 'Tracks user interactions with push notifications';
COMMENT ON TABLE notification_queue IS 'Queue system for scheduling and managing push notifications';

COMMENT ON COLUMN push_tokens.token IS 'Expo push token for sending notifications to specific device';
COMMENT ON COLUMN push_tokens.device_info IS 'JSON object containing device details like name, model, OS version';
COMMENT ON COLUMN user_notification_settings.quiet_hours_enabled IS 'Whether to respect quiet hours for notifications';
COMMENT ON COLUMN push_notification_logs.expo_ticket_id IS 'Expo service ticket ID for tracking delivery status';
COMMENT ON COLUMN notification_queue.priority IS 'Priority level 1-10, where 1 is highest priority';
