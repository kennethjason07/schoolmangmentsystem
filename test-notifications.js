// Test script to create sample notifications
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestNotifications() {
  try {
    console.log('Checking table structures...');
    
    // Check what's in the notifications table
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
    
    console.log('Notifications table sample:', notifications);
    if (notificationsError) console.log('Notifications error:', notificationsError);
    
    // Check what's in the notification_recipients table
    const { data: recipients, error: recipientsError } = await supabase
      .from('notification_recipients')
      .select('*')
      .limit(1);
    
    console.log('Notification recipients table sample:', recipients);
    if (recipientsError) console.log('Recipients error:', recipientsError);
    
    // Get all users first
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(3);
    
    console.log('Available users:', users);
    
    if (!users || users.length === 0) {
      console.log('No users found');
      return;
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestNotifications();
