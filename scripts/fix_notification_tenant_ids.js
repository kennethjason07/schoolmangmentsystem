const { createClient } = require('@supabase/supabase-js');

// Using the known Supabase configuration  
const supabaseUrl = process.env.SUPABASE_URL || 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

// Note: You need to provide the service role key. Check your Supabase dashboard -> Settings -> API

// Create a client with service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixNotificationTenantIds() {
  try {
    console.log('=== FIXING NOTIFICATION TENANT_IDS ===\n');

    // First, get all users to determine the correct tenant_id(s)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    const userTenantIds = [...new Set(users.map(u => u.tenant_id).filter(id => id !== null))];
    
    if (userTenantIds.length === 0) {
      console.error('No valid tenant_ids found in users table!');
      return;
    }

    if (userTenantIds.length > 1) {
      console.log('Multiple tenant_ids found in users table:');
      userTenantIds.forEach(id => console.log(`- ${id}`));
      console.log('\nThis script will update ALL notifications to use the first tenant_id.');
      console.log('If you need to assign notifications to different tenants, you should do this manually.\n');
    }

    const correctTenantId = userTenantIds[0];
    console.log(`Target tenant_id for notifications: ${correctTenantId}\n`);

    // Get all notifications that need fixing
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('id, type, tenant_id');
    
    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError);
      return;
    }

    const notificationsToFix = notifications.filter(n => 
      n.tenant_id !== correctTenantId || n.tenant_id === null || n.tenant_id === undefined
    );

    if (notificationsToFix.length === 0) {
      console.log('✅ All notifications already have the correct tenant_id!');
      return;
    }

    console.log(`Found ${notificationsToFix.length} notifications that need fixing:`);
    notificationsToFix.forEach(n => {
      console.log(`- "${n.type || 'Notification'}": current tenant_id = ${n.tenant_id}`);
    });
    console.log('');

    // Update notifications
    console.log('Updating notification tenant_ids...');
    
    const updatePromises = notificationsToFix.map(notification => 
      supabase
        .from('notifications')
        .update({ tenant_id: correctTenantId })
        .eq('id', notification.id)
    );

    const updateResults = await Promise.all(updatePromises);

    let successCount = 0;
    let errorCount = 0;

    updateResults.forEach((result, index) => {
      if (result.error) {
        console.error(`Error updating notification "${notificationsToFix[index].type || 'Notification'}":`, result.error);
        errorCount++;
      } else {
        successCount++;
      }
    });

    console.log(`\n=== RESULTS ===`);
    console.log(`✅ Successfully updated: ${successCount} notifications`);
    if (errorCount > 0) {
      console.log(`❌ Failed to update: ${errorCount} notifications`);
    }

    // Also fix notification_recipients if they exist
    const { data: recipients, error: recipientsError } = await supabase
      .from('notification_recipients')
      .select('id, notification_id, tenant_id');
    
    if (!recipientsError && recipients) {
      const recipientsToFix = recipients.filter(r => 
        r.tenant_id !== correctTenantId || r.tenant_id === null || r.tenant_id === undefined
      );

      if (recipientsToFix.length > 0) {
        console.log(`\nFound ${recipientsToFix.length} notification_recipients that need fixing...`);
        
        const recipientUpdatePromises = recipientsToFix.map(recipient => 
          supabase
            .from('notification_recipients')
            .update({ tenant_id: correctTenantId })
            .eq('id', recipient.id)
        );

        const recipientUpdateResults = await Promise.all(recipientUpdatePromises);

        let recipientSuccessCount = 0;
        let recipientErrorCount = 0;

        recipientUpdateResults.forEach((result) => {
          if (result.error) {
            recipientErrorCount++;
          } else {
            recipientSuccessCount++;
          }
        });

        console.log(`✅ Successfully updated notification_recipients: ${recipientSuccessCount}`);
        if (recipientErrorCount > 0) {
          console.log(`❌ Failed to update notification_recipients: ${recipientErrorCount}`);
        }
      }
    }

    console.log('\n=== NEXT STEPS ===');
    console.log('1. Test your mobile app to see if notifications now appear');
    console.log('2. Remove any temporary bypass code from NotificationManagement.js');
    console.log('3. Run the diagnosis script again to verify the fix: node scripts/diagnose_tenant_mismatch.js');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

fixNotificationTenantIds();
