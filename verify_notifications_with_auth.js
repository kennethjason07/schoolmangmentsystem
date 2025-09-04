const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyNotificationsWithAuth() {
  console.log('🔍 Verifying notifications database state...\n');
  
  try {
    // 1. Check raw table counts using authenticated context
    console.log('📋 Step 1: Checking table accessibility and counts...');
    
    // Try to get count without authentication first
    const { count: notifCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting notification count:', countError);
    } else {
      console.log(`✅ Notifications table count: ${notifCount || 0}`);
    }
    
    const { count: recipientCount, error: recipientCountError } = await supabase
      .from('notification_recipients')
      .select('*', { count: 'exact', head: true });
    
    if (recipientCountError) {
      console.error('❌ Error getting recipients count:', recipientCountError);
    } else {
      console.log(`✅ Notification recipients table count: ${recipientCount || 0}`);
    }
    
    // 2. Try to authenticate with a test user if possible
    console.log('\n📋 Step 2: Attempting to query with various approaches...');
    
    // Check if we can access any notifications using admin privileges or bypassing RLS
    console.log('🔍 Trying to access notifications through different methods...');
    
    // Method 1: Direct query (what we already tried)
    const { data: directNotifications, error: directError } = await supabase
      .from('notifications')
      .select('*')
      .limit(10);
    
    console.log(`📊 Direct query result: ${directNotifications?.length || 0} records`);
    if (directError) console.log(`   Error: ${directError.message}`);
    
    // Method 2: Query with specific tenant filter
    const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
    const { data: tenantNotifications, error: tenantError } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', knownTenantId)
      .limit(10);
    
    console.log(`📊 Tenant-filtered query result: ${tenantNotifications?.length || 0} records`);
    if (tenantError) console.log(`   Error: ${tenantError.message}`);
    
    // Method 3: Query notification_recipients
    const { data: directRecipients, error: directRecipientsError } = await supabase
      .from('notification_recipients')
      .select('*')
      .limit(10);
    
    console.log(`📊 Direct recipients query result: ${directRecipients?.length || 0} records`);
    if (directRecipientsError) console.log(`   Error: ${directRecipientsError.message}`);
    
    // 3. Check users table to understand tenant distribution
    console.log('\n📋 Step 3: Checking users distribution across tenants...');
    const { data: usersByTenant, error: usersError } = await supabase
      .from('users')
      .select('tenant_id, role_id, full_name')
      .not('tenant_id', 'is', null)
      .limit(20);
    
    if (usersError) {
      console.error('❌ Error querying users:', usersError);
    } else {
      console.log(`✅ Found ${usersByTenant?.length || 0} users with tenant_id`);
      
      // Group by tenant
      const tenantGroups = {};
      usersByTenant?.forEach(user => {
        if (!tenantGroups[user.tenant_id]) {
          tenantGroups[user.tenant_id] = [];
        }
        tenantGroups[user.tenant_id].push(user);
      });
      
      Object.keys(tenantGroups).forEach(tenantId => {
        console.log(`   📂 Tenant ${tenantId}: ${tenantGroups[tenantId].length} users`);
        tenantGroups[tenantId].slice(0, 3).forEach(user => {
          console.log(`      - ${user.full_name || 'No name'} (Role ID: ${user.role_id})`);
        });
      });
    }
    
    // 4. Check if there are specific RLS policies we need to understand
    console.log('\n📋 Step 4: Summary and recommendations...');
    
    if ((notifCount || 0) === 0 && (recipientCount || 0) === 0) {
      console.log('🎯 CONCLUSION: Tables are empty from database perspective');
      console.log('📱 However, your mobile app shows notifications, which means:');
      console.log('   1. Notifications exist but are protected by RLS policies');
      console.log('   2. Our unauthenticated queries cannot access them');
      console.log('   3. The mobile app has proper authentication context');
      
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. The notifications creation process is likely working');
      console.log('   2. The issue might be in how notifications are being fetched in the app');
      console.log('   3. Check if there are tenant ID mismatches in the fetching logic');
    } else {
      console.log('✅ Notifications exist in database and can be accessed');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during verification:', error);
  }
}

// Run the verification
verifyNotificationsWithAuth().then(() => {
  console.log('\n🏁 Notification verification completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
