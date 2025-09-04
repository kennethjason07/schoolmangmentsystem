const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CORRECT_TENANT_ID = 'b8f8b5f0-1234-4567-8901-123456789000';

async function finalNotificationFix() {
  console.log('🔧 Running final notification fix...\n');
  
  try {
    // Step 1: Try to find and fix any notifications that might exist
    console.log('📋 Step 1: Looking for notifications that might need tenant_id fixes...');
    
    // Try to query all notifications (might be blocked by RLS)
    const { data: allNotifications, error: allNotifsError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type, message, created_at, sent_by');
    
    if (allNotifsError) {
      console.log('❌ Cannot directly query notifications (RLS protected):', allNotifsError.message);
      console.log('🔒 This is expected behavior due to Row Level Security');
    } else {
      console.log(`✅ Found ${allNotifications?.length || 0} total notifications in database`);
      
      if (allNotifications && allNotifications.length > 0) {
        const nullTenantNotifs = allNotifications.filter(n => !n.tenant_id);
        const wrongTenantNotifs = allNotifications.filter(n => n.tenant_id && n.tenant_id !== CORRECT_TENANT_ID);
        const correctTenantNotifs = allNotifications.filter(n => n.tenant_id === CORRECT_TENANT_ID);
        
        console.log('📊 Notification breakdown:');
        console.log(`   ✅ Correct tenant: ${correctTenantNotifs.length}`);
        console.log(`   ❌ Wrong tenant: ${wrongTenantNotifs.length}`);
        console.log(`   ⚠️ NULL tenant: ${nullTenantNotifs.length}`);
        
        // Fix NULL tenant_id notifications
        if (nullTenantNotifs.length > 0) {
          console.log(`\n🔧 Fixing ${nullTenantNotifs.length} notifications with NULL tenant_id...`);
          
          const { data: fixedNullNotifs, error: fixNullError } = await supabase
            .from('notifications')
            .update({ tenant_id: CORRECT_TENANT_ID })
            .is('tenant_id', null)
            .select('id, type, message');
          
          if (fixNullError) {
            console.log('❌ Could not fix NULL tenant notifications:', fixNullError.message);
          } else {
            console.log(`✅ Fixed ${fixedNullNotifs?.length || 0} notifications with NULL tenant_id`);
            if (fixedNullNotifs && fixedNullNotifs.length > 0) {
              fixedNullNotifs.forEach((notif, i) => {
                console.log(`   ${i + 1}. ${notif.type}: ${notif.message.substring(0, 40)}...`);
              });
            }
          }
        }
        
        // Fix wrong tenant_id notifications  
        if (wrongTenantNotifs.length > 0) {
          console.log(`\n🔧 Fixing ${wrongTenantNotifs.length} notifications with wrong tenant_id...`);
          
          for (const wrongNotif of wrongTenantNotifs) {
            const { data: fixed, error: fixError } = await supabase
              .from('notifications')
              .update({ tenant_id: CORRECT_TENANT_ID })
              .eq('id', wrongNotif.id)
              .select('id, type');
            
            if (fixError) {
              console.log(`❌ Could not fix notification ${wrongNotif.id}:`, fixError.message);
            } else {
              console.log(`✅ Fixed notification ${wrongNotif.id} (${wrongNotif.type})`);
            }
          }
        }
      }
    }
    
    // Step 2: Check and fix notification_recipients
    console.log('\n📋 Step 2: Checking notification recipients...');
    
    const { data: allRecipients, error: recipientsError } = await supabase
      .from('notification_recipients')
      .select('id, notification_id, recipient_id, tenant_id');
    
    if (recipientsError) {
      console.log('❌ Cannot query notification recipients:', recipientsError.message);
    } else {
      console.log(`✅ Found ${allRecipients?.length || 0} notification recipients`);
      
      if (allRecipients && allRecipients.length > 0) {
        const nullTenantRecipients = allRecipients.filter(r => !r.tenant_id);
        const wrongTenantRecipients = allRecipients.filter(r => r.tenant_id && r.tenant_id !== CORRECT_TENANT_ID);
        
        if (nullTenantRecipients.length > 0) {
          console.log(`🔧 Fixing ${nullTenantRecipients.length} recipients with NULL tenant_id...`);
          
          const { data: fixedRecipients, error: fixRecipientsError } = await supabase
            .from('notification_recipients')
            .update({ tenant_id: CORRECT_TENANT_ID })
            .is('tenant_id', null)
            .select('id');
          
          if (fixRecipientsError) {
            console.log('❌ Could not fix NULL tenant recipients:', fixRecipientsError.message);
          } else {
            console.log(`✅ Fixed ${fixedRecipients?.length || 0} recipients with NULL tenant_id`);
          }
        }
        
        if (wrongTenantRecipients.length > 0) {
          console.log(`🔧 Fixing ${wrongTenantRecipients.length} recipients with wrong tenant_id...`);
          
          for (const wrongRecipient of wrongTenantRecipients) {
            const { error: fixRecipientError } = await supabase
              .from('notification_recipients')
              .update({ tenant_id: CORRECT_TENANT_ID })
              .eq('id', wrongRecipient.id);
            
            if (fixRecipientError) {
              console.log(`❌ Could not fix recipient ${wrongRecipient.id}:`, fixRecipientError.message);
            }
          }
          
          if (wrongTenantRecipients.length > 0) {
            console.log(`✅ Attempted to fix ${wrongTenantRecipients.length} recipients with wrong tenant_id`);
          }
        }
      }
    }
    
    // Step 3: Test the notification retrieval that the app will use
    console.log('\n📋 Step 3: Testing notification retrieval as the app would...');
    
    const { data: appNotifications, error: appError } = await supabase
      .from('notifications')
      .select(`
        *,
        notification_recipients(
          id,
          recipient_id,
          recipient_type,
          delivery_status,
          sent_at,
          tenant_id
        ),
        users!sent_by(
          id,
          full_name,
          role_id
        )
      `)
      .eq('tenant_id', CORRECT_TENANT_ID)
      .order('created_at', { ascending: false });
    
    if (appError) {
      console.log('❌ App-style query failed:', appError.message);
      console.log('🔒 This suggests RLS is still blocking access or there are no notifications');
    } else {
      console.log(`✅ App-style query found ${appNotifications?.length || 0} notifications`);
      
      if (appNotifications && appNotifications.length > 0) {
        console.log('📋 Sample notifications that the app would see:');
        appNotifications.slice(0, 3).forEach((notif, i) => {
          console.log(`   ${i + 1}. ${notif.type}: ${notif.message.substring(0, 40)}...`);
          console.log(`      Recipients: ${notif.notification_recipients?.length || 0}`);
          console.log(`      Sent by: ${notif.users?.full_name || 'Unknown'}`);
        });
      }
    }
    
    // Step 4: Try a bypass query (no tenant filter) to see what exists
    console.log('\n📋 Step 4: Testing bypass query (no tenant filter)...');
    
    const { data: bypassNotifications, error: bypassError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (bypassError) {
      console.log('❌ Bypass query failed:', bypassError.message);
    } else {
      console.log(`✅ Bypass query found ${bypassNotifications?.length || 0} notifications`);
      
      if (bypassNotifications && bypassNotifications.length > 0) {
        console.log('📋 All notifications found (regardless of tenant):');
        bypassNotifications.forEach((notif, i) => {
          const matches = notif.tenant_id === CORRECT_TENANT_ID;
          const icon = matches ? '✅' : '❌';
          console.log(`   ${icon} ${i + 1}. [${notif.tenant_id || 'NULL'}] ${notif.type}: ${notif.message.substring(0, 40)}...`);
        });
      } else {
        console.log('📭 The database appears to have no notifications at all');
        console.log('💡 This means the notifications you see in the app might be from a different source');
      }
    }
    
    console.log('\n🎯 FINAL DIAGNOSIS:');
    
    if (bypassNotifications && bypassNotifications.length === 0) {
      console.log('❓ MYSTERY: The database has no notifications, but your app shows them');
      console.log('🤔 Possible explanations:');
      console.log('   1. The app is connected to a different database/environment');
      console.log('   2. The notifications are stored in a different table');
      console.log('   3. There are RLS policies completely blocking external access');
      console.log('   4. The notifications are cached or mocked data in the app');
      
      console.log('\n🔍 RECOMMENDED INVESTIGATION:');
      console.log('   1. Check your app logs when loading notifications');
      console.log('   2. Verify the Supabase URL and key in your app match this script');
      console.log('   3. Look at the Network tab in browser dev tools to see actual API calls');
      console.log('   4. Check if the app is using mock/demo data');
    } else if (bypassNotifications && bypassNotifications.length > 0) {
      const matchingNotifications = bypassNotifications.filter(n => n.tenant_id === CORRECT_TENANT_ID);
      
      if (matchingNotifications.length > 0) {
        console.log('✅ SUCCESS: Found notifications with correct tenant_id');
        console.log(`📊 ${matchingNotifications.length} notifications should now be visible in your app`);
      } else {
        console.log('⚠️ TENANT MISMATCH: Notifications exist but with wrong tenant_ids');
        console.log('🔧 Run this script again - it should have fixed the tenant_ids');
      }
    }
    
    console.log('\n📱 NEXT STEPS:');
    console.log('1. Open your NotificationManagement screen in the app');
    console.log('2. Check the console logs for detailed tenant analysis');
    console.log('3. The enhanced debugging should now show all notifications');
    console.log('4. If still no notifications, there might be a deeper database connection issue');
    
  } catch (error) {
    console.error('💥 Unexpected error during final fix:', error);
  }
}

// Run the final fix
finalNotificationFix().then(() => {
  console.log('\n🏁 Final notification fix completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
