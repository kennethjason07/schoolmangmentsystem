/**
 * Test Leave Request Push Notifications
 * This script tests the complete flow of leave request notifications
 */

import { supabase } from './src/utils/supabase.js';
import { createLeaveRequestNotificationForAdmins } from './src/services/notificationService.js';

/**
 * Test function to create a mock leave request notification
 */
async function testLeaveRequestNotification() {
  try {
    console.log('🧪 Testing Leave Request Push Notification System...\n');

    // Mock leave data (similar to what would come from LeaveApplication form)
    const mockLeaveData = {
      leave_type: 'Sick Leave',
      start_date: 'Dec 15, 2024',
      end_date: 'Dec 16, 2024',
      reason: 'Medical appointment and recovery',
      total_days: 2
    };

    // Mock teacher profile data
    const mockTeacherData = {
      full_name: 'Test Teacher',
      teacher: {
        name: 'Test Teacher'
      },
      linked_teacher_id: 'mock-teacher-id'
    };

    // Mock user ID (teacher who submitted the leave)
    const mockSentBy = 'mock-teacher-user-id';

    console.log('📋 Test Leave Data:');
    console.log(`  Leave Type: ${mockLeaveData.leave_type}`);
    console.log(`  Duration: ${mockLeaveData.start_date} to ${mockLeaveData.end_date}`);
    console.log(`  Days: ${mockLeaveData.total_days}`);
    console.log(`  Teacher: ${mockTeacherData.full_name}`);
    console.log(`  Reason: ${mockLeaveData.reason}\n`);

    console.log('🚀 Creating leave request notification for admins...');
    const result = await createLeaveRequestNotificationForAdmins(
      mockLeaveData,
      mockTeacherData,
      mockSentBy
    );

    if (result.success) {
      console.log('✅ SUCCESS! Leave request notification created successfully');
      console.log(`📧 Notification ID: ${result.notification?.id}`);
      console.log(`👥 Admin recipients: ${result.recipientCount}`);
      console.log('\n📱 Push Notification Details:');
      console.log(`  Title: New Leave Request`);
      console.log(`  Message: ${mockTeacherData.full_name} has submitted a ${mockLeaveData.leave_type} request (${mockLeaveData.start_date} to ${mockLeaveData.end_date})`);
    } else {
      console.log('❌ FAILED! Leave request notification creation failed');
      console.log(`Error: ${result.error}`);
    }

    console.log('\n🔍 Verification Steps:');
    console.log('1. Check AdminNotifications screen for new notification');
    console.log('2. Verify push notification appears on admin devices');
    console.log('3. Check notification database tables for proper records');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

/**
 * Test admin users query to ensure admins exist
 */
async function testAdminUsersQuery() {
  try {
    console.log('\n🔍 Testing Admin Users Query...');
    
    const { data: adminUsers, error } = await supabase
      .from('users')
      .select('id, full_name, email, role_id')
      .eq('role_id', 1);
    
    if (error) {
      console.error('❌ Error fetching admin users:', error);
      return;
    }

    console.log(`📊 Found ${adminUsers?.length || 0} admin users:`);
    if (adminUsers && adminUsers.length > 0) {
      adminUsers.forEach((admin, index) => {
        console.log(`  ${index + 1}. ${admin.full_name} (${admin.email}) - ID: ${admin.id}`);
      });
    } else {
      console.log('⚠️ No admin users found! Make sure there are users with role_id = 1');
    }
  } catch (error) {
    console.error('❌ Admin users query failed:', error);
  }
}

/**
 * Test push tokens availability for admin users
 */
async function testPushTokensForAdmins() {
  try {
    console.log('\n📱 Testing Push Tokens for Admin Users...');
    
    // Get admin users
    const { data: adminUsers, error: adminError } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role_id', 1);
    
    if (adminError || !adminUsers || adminUsers.length === 0) {
      console.log('❌ No admin users found');
      return;
    }

    console.log(`🔍 Checking push tokens for ${adminUsers.length} admin users...`);
    
    for (const admin of adminUsers) {
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('id, token, is_active, updated_at')
        .eq('user_id', admin.id)
        .eq('is_active', true);

      if (tokenError) {
        console.log(`  ❌ ${admin.full_name}: Error fetching tokens - ${tokenError.message}`);
      } else if (!tokens || tokens.length === 0) {
        console.log(`  ⚠️ ${admin.full_name}: No active push tokens found`);
      } else {
        console.log(`  ✅ ${admin.full_name}: ${tokens.length} active push token(s)`);
        tokens.forEach((token, idx) => {
          console.log(`    ${idx + 1}. Token: ${token.token.substring(0, 20)}... (Updated: ${new Date(token.updated_at).toLocaleString()})`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Push tokens test failed:', error);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🧪 LEAVE REQUEST PUSH NOTIFICATION TEST SUITE');
  console.log('='.repeat(50));
  
  await testAdminUsersQuery();
  await testPushTokensForAdmins();
  await testLeaveRequestNotification();
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 Test suite completed');
  
  process.exit(0);
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export {
  testLeaveRequestNotification,
  testAdminUsersQuery,
  testPushTokensForAdmins
};
