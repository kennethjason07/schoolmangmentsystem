const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDatabase() {
  console.log('🔍 Starting direct database query to verify notifications table content...\n');
  
  try {
    // 1. Check table existence by trying to access without filters
    console.log('📋 Step 1: Checking if notifications table is accessible...');
    const { data: schemaCheck, error: schemaError } = await supabase
      .from('notifications')
      .select('count', { count: 'exact', head: true });
    
    if (schemaError) {
      console.error('❌ Table access failed:', schemaError);
      return;
    }
    console.log(`✅ Notifications table is accessible. Count query result: ${schemaCheck}`);
    
    // 2. Try to get ALL notifications without any filters (bypassing RLS temporarily)
    console.log('\n📋 Step 2: Attempting to query ALL notifications (no filters)...');
    const { data: allNotifications, error: allError } = await supabase
      .from('notifications')
      .select('*');
    
    if (allError) {
      console.error('❌ Error querying all notifications:', allError);
      if (allError.message.includes('RLS') || allError.message.includes('policy')) {
        console.log('🔒 This appears to be an RLS policy issue');
      }
    } else {
      console.log(`✅ Successfully queried notifications. Found ${allNotifications?.length || 0} records`);
      if (allNotifications && allNotifications.length > 0) {
        console.log('\n📄 First few notifications:');
        allNotifications.slice(0, 3).forEach((notif, index) => {
          console.log(`${index + 1}. ID: ${notif.id}, Title: ${notif.title}, Tenant ID: ${notif.tenant_id}, Created: ${notif.created_at}`);
        });
      }
    }
    
    // 3. Check notification_recipients table
    console.log('\n📋 Step 3: Checking notification_recipients table...');
    const { data: allRecipients, error: recipientsError } = await supabase
      .from('notification_recipients')
      .select('*');
    
    if (recipientsError) {
      console.error('❌ Error querying notification recipients:', recipientsError);
    } else {
      console.log(`✅ Successfully queried notification_recipients. Found ${allRecipients?.length || 0} records`);
      if (allRecipients && allRecipients.length > 0) {
        console.log('\n📄 First few recipients:');
        allRecipients.slice(0, 3).forEach((recip, index) => {
          console.log(`${index + 1}. Notification ID: ${recip.notification_id}, Recipient ID: ${recip.recipient_id}, Type: ${recip.recipient_type}`);
        });
      }
    }
    
    // 4. Check what tenants exist
    console.log('\n📋 Step 4: Checking available tenants...');
    const { data: tenants, error: tenantsError } = await supabase
      .from('users')
      .select('tenant_id')
      .not('tenant_id', 'is', null);
    
    if (tenantsError) {
      console.error('❌ Error querying tenant IDs from users:', tenantsError);
    } else {
      const uniqueTenants = [...new Set(tenants?.map(u => u.tenant_id) || [])];
      console.log(`✅ Found ${uniqueTenants.length} unique tenant IDs in users table:`);
      uniqueTenants.forEach(tenantId => {
        console.log(`   - ${tenantId}`);
      });
    }
    
    // 5. Check if there's a dedicated tenants table
    console.log('\n📋 Step 5: Checking tenants table...');
    const { data: tenantsTable, error: tenantsTableError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status')
      .limit(10);
    
    if (tenantsTableError) {
      console.error('❌ Error querying tenants table:', tenantsTableError);
    } else {
      console.log(`✅ Found ${tenantsTable?.length || 0} tenants in tenants table:`);
      if (tenantsTable && tenantsTable.length > 0) {
        tenantsTable.forEach(tenant => {
          console.log(`   - ID: ${tenant.id}, Name: ${tenant.name}, Subdomain: ${tenant.subdomain}, Status: ${tenant.status}`);
        });
      }
    }
    
    // 6. Check current authentication status
    console.log('\n📋 Step 6: Checking current auth status...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Error getting current user:', userError);
    } else if (user) {
      console.log('✅ Currently authenticated user:');
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Metadata tenant_id: ${user.app_metadata?.tenant_id || user.user_metadata?.tenant_id || 'none'}`);
    } else {
      console.log('❌ No authenticated user found');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during database debug:', error);
  }
}

// Run the debug
debugDatabase().then(() => {
  console.log('\n🏁 Database debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
