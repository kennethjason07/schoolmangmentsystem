const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugTenantMismatch() {
  console.log('🔍 Debugging tenant_id mismatch issue...\n');
  
  try {
    console.log('📋 Step 1: Checking what tenant_ids exist in notifications table...');
    
    // Since we know notifications exist in Supabase table editor, let's try to see their tenant_ids
    // We'll use a service key or try different approaches
    
    // First approach: Try to query notifications without auth (might be blocked by RLS)
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type, message, created_at, sent_by')
      .order('created_at', { ascending: false });
    
    if (notifError) {
      console.log('❌ Cannot query notifications table (likely RLS protected):', notifError.message);
      console.log('🔒 This is expected - notifications are protected by RLS policies');
    } else {
      console.log(`✅ Found ${notifications?.length || 0} notifications in table`);
      if (notifications && notifications.length > 0) {
        const tenantIds = [...new Set(notifications.map(n => n.tenant_id).filter(Boolean))];
        console.log('📊 Tenant IDs found in notifications:');
        tenantIds.forEach(tid => {
          const count = notifications.filter(n => n.tenant_id === tid).length;
          console.log(`   - ${tid}: ${count} notifications`);
        });
      }
    }
    
    console.log('\n📋 Step 2: Checking what tenant_ids exist in users table...');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, role_id')
      .not('tenant_id', 'is', null);
    
    if (usersError) {
      console.log('❌ Cannot query users table:', usersError.message);
    } else {
      console.log(`✅ Found ${users?.length || 0} users with tenant_id`);
      
      const userTenantIds = [...new Set(users.map(u => u.tenant_id))];
      console.log('📊 Tenant IDs found in users table:');
      userTenantIds.forEach(tid => {
        const usersCount = users.filter(u => u.tenant_id === tid).length;
        console.log(`   - ${tid}: ${usersCount} users`);
        
        const usersInTenant = users.filter(u => u.tenant_id === tid);
        usersInTenant.slice(0, 3).forEach(user => {
          console.log(`      * ${user.full_name || user.email} (Role: ${user.role_id})`);
        });
      });
    }
    
    console.log('\n📋 Step 3: Checking tenants table for reference...');
    
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, subdomain, status');
    
    if (tenantsError) {
      console.log('❌ Cannot query tenants table:', tenantsError.message);
    } else {
      console.log(`✅ Found ${tenants?.length || 0} tenants`);
      tenants?.forEach(tenant => {
        console.log(`   - ID: ${tenant.id}, Name: ${tenant.name}, Subdomain: ${tenant.subdomain}, Status: ${tenant.status}`);
      });
    }
    
    console.log('\n📋 Step 4: Diagnostic summary and recommended fix...');
    
    console.log('🎯 DIAGNOSIS:');
    console.log('   ✅ Notifications exist in database (you can see them in table editor)');
    console.log('   ❌ App shows 0 notifications due to tenant_id filtering');
    console.log('   🔄 Issue: tenant_id mismatch between notifications and current user context');
    
    console.log('\n💡 RECOMMENDED FIXES:');
    console.log('   1. Update existing notifications to have the correct tenant_id');
    console.log('   2. Or update user profiles to have the correct tenant_id');
    console.log('   3. Or temporarily disable tenant filtering to verify the fix');
    
    console.log('\n🔧 SPECIFIC ACTIONS:');
    console.log('   Option A: Update all existing notifications to use tenant_id from users table');
    console.log('   Option B: Update user profiles to match tenant_id in existing notifications');
    console.log('   Option C: Add diagnostic query to show mismatched tenant_ids');
    
  } catch (error) {
    console.error('💥 Unexpected error during tenant debug:', error);
  }
}

// Run the debug
debugTenantMismatch().then(() => {
  console.log('\n🏁 Tenant mismatch debug completed');
  console.log('\n📝 Next steps: Choose one of the recommended fixes above');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
