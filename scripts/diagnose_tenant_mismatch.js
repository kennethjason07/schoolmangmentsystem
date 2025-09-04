const { createClient } = require('@supabase/supabase-js');

// Using the known Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

// Note: You need to provide the service role key. Check your Supabase dashboard -> Settings -> API
// The service role key is different from the anon key and bypasses RLS policies

if (!supabaseUrl) {
  console.error('Error: SUPABASE_URL environment variable is not set.');
  console.error('Please set it before running the script:');
  console.error('  export SUPABASE_URL="YOUR_ACTUAL_SUPABASE_URL"');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set.');
  console.error('Please set it before running the script:');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="YOUR_ACTUAL_SUPABASE_SERVICE_ROLE_KEY"');
  process.exit(1);
}

// Create a client with service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseTenantMismatch() {
  try {
    console.log('=== TENANT MISMATCH DIAGNOSIS ===\n');

    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name');
    
    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      return;
    }

    console.log('Available tenants:');
    tenants.forEach(tenant => {
      console.log(`- ${tenant.name} (ID: ${tenant.id})`);
    });
    console.log('');

    // Get all users with their tenant_ids
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    console.log('Users and their tenant_ids:');
    users.forEach(user => {
      console.log(`- ${user.email}: tenant_id = ${user.tenant_id}`);
    });
    console.log('');

    // Get all notifications with their tenant_ids
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('id, title, tenant_id, created_at');
    
    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
      return;
    }

    console.log('Notifications and their tenant_ids:');
    notifications.forEach(notification => {
      console.log(`- "${notification.title}" (ID: ${notification.id}): tenant_id = ${notification.tenant_id}`);
    });
    console.log('');

    // Analyze mismatches
    const userTenantIds = [...new Set(users.map(u => u.tenant_id))];
    const notificationTenantIds = [...new Set(notifications.map(n => n.tenant_id))];

    console.log('=== ANALYSIS ===');
    console.log(`User tenant_ids: [${userTenantIds.join(', ')}]`);
    console.log(`Notification tenant_ids: [${notificationTenantIds.join(', ')}]`);

    const mismatchedNotifications = notifications.filter(n => !userTenantIds.includes(n.tenant_id));
    const orphanedNotifications = notifications.filter(n => n.tenant_id === null || n.tenant_id === undefined);

    if (mismatchedNotifications.length > 0) {
      console.log('\n🔴 MISMATCHED NOTIFICATIONS (tenant_id doesn\'t match any user):');
      mismatchedNotifications.forEach(n => {
        console.log(`- "${n.title}": tenant_id = ${n.tenant_id}`);
      });
    }

    if (orphanedNotifications.length > 0) {
      console.log('\n🔴 ORPHANED NOTIFICATIONS (null/undefined tenant_id):');
      orphanedNotifications.forEach(n => {
        console.log(`- "${n.title}": tenant_id = ${n.tenant_id}`);
      });
    }

    if (mismatchedNotifications.length === 0 && orphanedNotifications.length === 0) {
      console.log('\n✅ All notifications have matching tenant_ids!');
    } else {
      console.log('\n=== RECOMMENDED FIXES ===');
      
      if (userTenantIds.length === 1) {
        const correctTenantId = userTenantIds[0];
        console.log(`Since all users belong to tenant_id "${correctTenantId}", you can fix all notifications by updating them to use this tenant_id.`);
        console.log(`\nRun the fix script: node scripts/fix_notification_tenant_ids.js`);
      } else {
        console.log('Multiple user tenant_ids found. You\'ll need to manually assign notifications to appropriate tenants.');
        console.log('Consider which tenant each notification should belong to based on its content and purpose.');
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

diagnoseTenantMismatch();
