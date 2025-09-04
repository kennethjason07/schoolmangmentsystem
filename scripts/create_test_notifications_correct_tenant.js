const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';
const correctTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';

if (supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY') {
  console.log('❌ Please set your service role key:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/create_test_notifications_correct_tenant.js');
  process.exit(1);
}

console.log('=== CREATING TEST NOTIFICATIONS WITH CORRECT TENANT_ID ===\n');

async function createTestNotifications() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    // Get a user to use as sender
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id')
      .eq('tenant_id', correctTenantId)
      .limit(1);
    
    if (usersError || !users || users.length === 0) {
      console.error('Error getting users:', usersError);
      return;
    }
    
    const senderUserId = users[0].id;
    console.log('Using sender:', users[0].email);
    console.log('Sender tenant_id:', users[0].tenant_id);
    console.log('');
    
    // Create test notifications with correct tenant_id
    const testNotifications = [
      {
        type: 'General',
        message: 'Welcome to the school management system! This is a test notification to verify tenant_id filtering.',
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: correctTenantId,
        sent_by: senderUserId,
        created_at: new Date().toISOString()
      },
      {
        type: 'Urgent',
        message: 'URGENT: School closure notice. Please check your email for detailed information.',
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: correctTenantId,
        sent_by: senderUserId,
        created_at: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      },
      {
        type: 'Event',
        message: 'Annual Sports Day is scheduled for next Friday. All students are encouraged to participate.',
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: correctTenantId,
        sent_by: senderUserId,
        created_at: new Date(Date.now() - 120000).toISOString() // 2 minutes ago
      },
      {
        type: 'Fee Reminder',
        message: 'Monthly school fees are due by the end of this week. Please make payment to avoid late charges.',
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: correctTenantId,
        sent_by: senderUserId,
        created_at: new Date(Date.now() - 180000).toISOString() // 3 minutes ago
      },
      {
        type: 'Homework',
        message: 'Mathematics homework for Class 10 has been assigned. Due date: Friday.',
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: correctTenantId,
        sent_by: senderUserId,
        created_at: new Date(Date.now() - 240000).toISOString() // 4 minutes ago
      }
    ];
    
    console.log('Creating test notifications...');
    
    const { data: insertedNotifications, error: insertError } = await supabase
      .from('notifications')
      .insert(testNotifications)
      .select();
    
    if (insertError) {
      console.error('Error inserting notifications:', insertError);
      return;
    }
    
    console.log(`✅ Successfully created ${insertedNotifications.length} test notifications:\n`);
    
    insertedNotifications.forEach((notif, index) => {
      console.log(`${index + 1}. "${notif.message.substring(0, 60)}..."`);
      console.log(`   - ID: ${notif.id}`);
      console.log(`   - Type: ${notif.type}`);
      console.log(`   - Tenant: ${notif.tenant_id}`);
      console.log(`   - Correct tenant: ${notif.tenant_id === correctTenantId}`);
      console.log('');
    });
    
    // Also create some notification recipients for testing
    console.log('Creating notification recipients...');
    
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email, role_id, tenant_id')
      .eq('tenant_id', correctTenantId);
    
    if (allUsersError || !allUsers || allUsers.length === 0) {
      console.log('⚠️ Could not fetch users for recipients:', allUsersError?.message);
    } else {
      console.log(`Found ${allUsers.length} users to create recipients for`);
      
      // Create recipients for the first notification (welcome message)
      const welcomeNotificationId = insertedNotifications[0].id;
      const recipients = allUsers
        .filter(user => user.role_id === 2 || user.role_id === 3) // Students and parents only
        .map(user => ({
          notification_id: welcomeNotificationId,
          recipient_id: user.id,
          recipient_type: user.role_id === 2 ? 'Student' : 'Parent',
          delivery_status: 'Pending',
          tenant_id: correctTenantId
        }));
      
      if (recipients.length > 0) {
        const { data: recipientsResult, error: recipientsError } = await supabase
          .from('notification_recipients')
          .insert(recipients)
          .select();
        
        if (recipientsError) {
          console.log('⚠️ Could not create recipients:', recipientsError.message);
        } else {
          console.log(`✅ Created ${recipientsResult.length} notification recipients`);
        }
      }
    }
    
    console.log('=== VERIFICATION ===');
    console.log('Testing if notifications are now accessible...');
    
    // Test with anon key (what the app uses)
    const anonSupabase = createClient(supabaseUrl, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8');
    
    const { data: testQuery, error: testError } = await anonSupabase
      .from('notifications')
      .select('id, type, message, tenant_id')
      .eq('tenant_id', correctTenantId)
      .limit(3);
    
    console.log('Test query with correct tenant_id:');
    console.log('   - Found:', testQuery?.length || 0);
    console.log('   - Error:', testError?.message || 'None');
    
    if (testQuery && testQuery.length > 0) {
      console.log('✅ Notifications are accessible with tenant filtering!');
    } else if (testError?.code === '42501') {
      console.log('🔒 Still blocked by RLS - need to authenticate first');
    } else {
      console.log('⚠️ Other issue - check logs');
    }
    
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Test your NotificationManagement.js screen');
    console.log('2. Check the console logs for JWT_DEBUG and getUserTenantId output');
    console.log('3. If still no notifications, the issue is authentication/JWT not containing tenant_id');
    console.log('4. Run fix_user_metadata.js to update JWT tokens if needed');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

createTestNotifications();
