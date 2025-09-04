const { createClient } = require('@supabase/supabase-js');

// Replace with your actual service role key
const serviceKey = 'YOUR_SERVICE_ROLE_KEY_HERE';
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';

if (serviceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
  console.log('❌ Please replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key');
  console.log('Get it from: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function testServiceKey() {
  try {
    console.log('🔓 Testing with service key...\n');
    
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(10);
    
    console.log('Service key result:');
    console.log('  - Found notifications:', notifications?.length || 0);
    console.log('  - Error:', error?.message || 'None');
    
    if (notifications && notifications.length > 0) {
      console.log('\n✅ NOTIFICATIONS EXIST! The issue is RLS/tenant filtering.');
      console.log('Notifications found:');
      notifications.forEach(n => {
        console.log(`  - "${n.message?.substring(0, 50)}..." (tenant: ${n.tenant_id})`);
      });
    } else {
      console.log('\n❌ NO NOTIFICATIONS EXIST in the database at all.');
      console.log('You need to create some notifications first.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testServiceKey();
