const { createClient } = require('@supabase/supabase-js');

// Using the anon key first to see what's accessible with normal permissions
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

console.log('=== TESTING NOTIFICATION EXISTENCE ===\n');

async function testWithAnonKey() {
  console.log('🔍 Testing with anon key (what the app sees)...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Test 1: Check if we can access the notifications table at all
    const { data: count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true });
    
    console.log('Count query result:');
    console.log('  - Accessible:', !countError);
    console.log('  - Error:', countError?.message || 'None');
    console.log('  - Error code:', countError?.code || 'None');
    
    // Test 2: Try to read some notifications
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id, created_at')
      .limit(5);
    
    console.log('\nDirect query result:');
    console.log('  - Found:', notifications?.length || 0);
    console.log('  - Error:', notifError?.message || 'None');
    console.log('  - Error code:', notifError?.code || 'None');
    
    if (notifications && notifications.length > 0) {
      console.log('  - Sample notifications:');
      notifications.forEach(n => {
        console.log(`    * ID: ${n.id}, Tenant: ${n.tenant_id}, Type: ${n.type}`);
      });
    }
    
    // Test 3: Check if it's an RLS issue by testing another table
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id')
      .limit(3);
    
    console.log('\nUsers table test (for comparison):');
    console.log('  - Accessible:', !usersError);
    console.log('  - Found:', users?.length || 0);
    console.log('  - Error:', usersError?.message || 'None');
    
    if (users && users.length > 0) {
      console.log('  - Sample users:');
      users.forEach(u => {
        console.log(`    * Email: ${u.email}, Tenant: ${u.tenant_id}`);
      });
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

async function testWithServiceKey() {
  console.log('\n🔓 Testing with service key (bypass RLS)...\n');
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey) {
    console.log('⚠️ Service key not provided, skipping service key test');
    console.log('To test with service key, set: SUPABASE_SERVICE_ROLE_KEY=your_service_key');
    return;
  }
  
  const supabase = createClient(supabaseUrl, serviceKey);
  
  try {
    // Test with service key to bypass RLS
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id, created_at')
      .limit(10);
    
    console.log('Service key query result:');
    console.log('  - Found:', notifications?.length || 0);
    console.log('  - Error:', error?.message || 'None');
    
    if (notifications && notifications.length > 0) {
      console.log('  - All notifications with tenant_ids:');
      notifications.forEach(n => {
        console.log(`    * "${n.message?.substring(0, 40)}..." -> tenant_id: ${n.tenant_id}`);
      });
      
      // Check tenant_id distribution
      const tenantCounts = {};
      notifications.forEach(n => {
        const tid = n.tenant_id || 'NULL';
        tenantCounts[tid] = (tenantCounts[tid] || 0) + 1;
      });
      
      console.log('\n  - Tenant distribution:');
      Object.entries(tenantCounts).forEach(([tid, count]) => {
        console.log(`    * tenant_id '${tid}': ${count} notifications`);
      });
    }
    
  } catch (error) {
    console.error('Service key test error:', error);
  }
}

// Run tests
testWithAnonKey()
  .then(() => testWithServiceKey())
  .then(() => {
    console.log('\n=== SUMMARY ===');
    console.log('If anon key shows 0 notifications but service key shows notifications,');
    console.log('then it\'s an RLS/tenant_id filtering issue.');
    console.log('If both show 0, then no notifications exist in the database.');
  });
