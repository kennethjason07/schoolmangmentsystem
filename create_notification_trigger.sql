-- Create a trigger to automatically set delivery_status to 'Sent' for InApp notifications
-- This ensures new notifications are marked as sent immediately since they're delivered via the app

-- First, create the trigger function
CREATE OR REPLACE FUNCTION update_notification_delivery_status()
RETURNS TRIGGER AS $$
BEGIN
  -- For InApp notifications, automatically set status to 'Sent' and set sent_at
  IF NEW.delivery_mode = 'InApp' AND NEW.delivery_status = 'Pending' THEN
    NEW.delivery_status := 'Sent';
    NEW.sent_at := COALESCE(NEW.sent_at, NEW.created_at);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that fires before insert or update
DROP TRIGGER IF EXISTS trigger_update_notification_delivery_status ON notifications;
CREATE TRIGGER trigger_update_notification_delivery_status
  BEFORE INSERT OR UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_delivery_status();

-- Test the trigger by checking if it was created successfully
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_notification_delivery_status';
