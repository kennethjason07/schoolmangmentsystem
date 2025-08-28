import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase URL and key
const SUPABASE_URL = 'your-supabase-url';
const SUPABASE_ANON_KEY = 'your-supabase-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugNotificationCount() {
  try {
    console.log('🔍 Debug: Checking notification recipients table...');
    
    // First, let's see all notification recipients in the system
    const { data: allRecipients, error: allError } = await supabase
      .from('notification_recipients')
      .select(`
        id,
        recipient_id,
        recipient_type,
        is_read,
        notifications!inner(id, message, type, created_at)
      `)
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error fetching all recipients:', allError);
      return;
    }
    
    console.log('📊 All notification recipients:', allRecipients?.length || 0);
    
    // Group by recipient type
    const byType = {};
    allRecipients.forEach(r => {
      if (!byType[r.recipient_type]) byType[r.recipient_type] = [];
      byType[r.recipient_type].push(r);
    });
    
    console.log('📋 Recipients by type:');
    Object.keys(byType).forEach(type => {
      const unreadCount = byType[type].filter(r => !r.is_read).length;
      console.log(`   ${type}: ${byType[type].length} total, ${unreadCount} unread`);
    });
    
    // Check specifically for Teacher recipient type
    const { data: teacherRecipients, error: teacherError } = await supabase
      .from('notification_recipients')
      .select(`
        id,
        recipient_id,
        recipient_type,
        is_read,
        notifications!inner(id, message, type, created_at)
      `)
      .eq('recipient_type', 'Teacher')
      .order('created_at', { ascending: false });
    
    if (teacherError) {
      console.error('❌ Error fetching teacher recipients:', teacherError);
    } else {
      console.log('👩‍🏫 Teacher notifications:', teacherRecipients?.length || 0);
      teacherRecipients?.forEach((r, index) => {
        console.log(`   ${index + 1}. User: ${r.recipient_id}, Read: ${r.is_read}, Message: "${r.notifications.message.substring(0, 50)}..."`);
      });
    }
    
    // Check specifically for Admin recipient type
    const { data: adminRecipients, error: adminError } = await supabase
      .from('notification_recipients')
      .select(`
        id,
        recipient_id,
        recipient_type,
        is_read,
        notifications!inner(id, message, type, created_at)
      `)
      .eq('recipient_type', 'Admin')
      .order('created_at', { ascending: false });
    
    if (adminError) {
      console.error('❌ Error fetching admin recipients:', adminError);
    } else {
      console.log('👨‍💼 Admin notifications:', adminRecipients?.length || 0);
      adminRecipients?.forEach((r, index) => {
        console.log(`   ${index + 1}. User: ${r.recipient_id}, Read: ${r.is_read}, Message: "${r.notifications.message.substring(0, 50)}..."`);
      });
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// To test a specific user's notification count
async function testNotificationCountForUser(userId, recipientType) {
  try {
    console.log(`🔔 Testing notification count for user ${userId} with type ${recipientType}...`);
    
    const { data, error, count } = await supabase
      .from('notification_recipients')
      .select('id', { count: 'exact' })
      .eq('recipient_id', userId)
      .eq('recipient_type', recipientType)
      .eq('is_read', false);
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Unread count:', count || data?.length || 0);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Export functions for manual testing
export { debugNotificationCount, testNotificationCountForUser };

// Run debug if this file is executed directly
if (require.main === module) {
  debugNotificationCount();
}
