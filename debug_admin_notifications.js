const { createClient } = require('@supabase/supabase-js');

// You'll need to replace these with your actual Supabase credentials
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'your-supabase-url';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-supabase-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAdminNotifications() {
  try {
    console.log('🔍 Checking notification_recipients table...');
    
    // First, check all notification recipients grouped by type
    const { data: summary, error: summaryError } = await supabase
      .from('notification_recipients')
      .select('recipient_type, is_read')
      .order('recipient_type');
    
    if (summaryError) {
      console.error('❌ Error fetching notification summary:', summaryError);
      return;
    }
    
    // Group and count
    const counts = {};
    summary.forEach(item => {
      if (!counts[item.recipient_type]) {
        counts[item.recipient_type] = { total: 0, unread: 0, read: 0 };
      }
      counts[item.recipient_type].total++;
      if (item.is_read) {
        counts[item.recipient_type].read++;
      } else {
        counts[item.recipient_type].unread++;
      }
    });
    
    console.log('\n📊 Notification counts by recipient type:');
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`   ${type}: Total=${count.total}, Unread=${count.unread}, Read=${count.read}`);
    });
    
    // Check admin users specifically
    console.log('\n🔍 Checking admin users...');
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, email, role_id, full_name')
      .eq('role_id', 1); // Assuming role_id 1 = Admin
    
    if (adminError) {
      console.error('❌ Error fetching admin users:', adminError);
      return;
    }
    
    console.log(`📋 Found ${adminUsers.length} admin users:`);
    adminUsers.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.email} (ID: ${admin.id}) - ${admin.full_name}`);
    });
    
    // For each admin, check their unread notifications
    for (const admin of adminUsers) {
      console.log(`\n🔍 Checking notifications for admin: ${admin.email}`);
      
      const { data: adminNotifs, error: adminNotifsError } = await supabase
        .from('notification_recipients')
        .select(`
          id, 
          is_read, 
          sent_at,
          notifications(id, message, type, created_at)
        `)
        .eq('recipient_id', admin.id)
        .eq('recipient_type', 'Admin')
        .eq('is_read', false)
        .order('sent_at', { ascending: false });
      
      if (adminNotifsError) {
        console.error(`❌ Error fetching notifications for ${admin.email}:`, adminNotifsError);
        continue;
      }
      
      console.log(`   📊 Unread notifications for ${admin.email}: ${adminNotifs.length}`);
      
      adminNotifs.forEach((notif, index) => {
        console.log(`   ${index + 1}. "${notif.notifications?.message}" (Type: ${notif.notifications?.type}, Created: ${notif.notifications?.created_at})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug function
debugAdminNotifications().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
