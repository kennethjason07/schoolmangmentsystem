// Debug script to check notification count discrepancy
// Run this to see what's contributing to the badge count

import { supabase, TABLES, getUserTenantId } from './src/utils/supabase.js';

// Replace with the actual teacher's user ID (check browser console when logged in)
const TEACHER_USER_ID = 'your-teacher-user-id-here';
const USER_TYPE = 'teacher'; // Use 'Teacher' if that's what's stored in your database

async function debugNotificationCount() {
  console.log('🔍 Debugging notification count for teacher...');
  console.log('Teacher User ID:', TEACHER_USER_ID);
  console.log('User Type:', USER_TYPE);
  console.log('═══════════════════════════════════════');

  try {
    const tenantId = await getUserTenantId();
    console.log('Tenant ID:', tenantId);

    // 1. Check unread MESSAGES (chat messages)
    console.log('\n📨 STEP 1: Checking unread MESSAGES (chat)');
    console.log('─────────────────────────────────────');
    
    const { data: unreadMessages, error: messageError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, receiver_id, message, is_read, sent_at')
      .eq('receiver_id', TEACHER_USER_ID)
      .eq('is_read', false)
      .order('sent_at', { ascending: false });

    if (messageError) {
      console.error('❌ Error fetching messages:', messageError);
    } else {
      console.log(`📊 Unread chat messages: ${unreadMessages?.length || 0}`);
      if (unreadMessages && unreadMessages.length > 0) {
        console.log('Recent unread messages:');
        unreadMessages.slice(0, 3).forEach((msg, idx) => {
          console.log(`  ${idx + 1}. From: ${msg.sender_id}`);
          console.log(`     Message: "${msg.message?.substring(0, 50)}..."`);
          console.log(`     Sent: ${new Date(msg.sent_at).toLocaleString()}`);
          console.log('');
        });
      }
    }

    // 2. Check unread NOTIFICATIONS (formal notifications)
    console.log('\n🔔 STEP 2: Checking unread NOTIFICATIONS (formal)');
    console.log('─────────────────────────────────────');
    
    const { data: unreadNotifications, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        recipient_type,
        sent_at,
        notifications!inner (
          id,
          message,
          type,
          created_at
        )
      `)
      .eq('recipient_id', TEACHER_USER_ID)
      .eq('recipient_type', 'Teacher')
      .eq('tenant_id', tenantId)
      .eq('is_read', false)
      .order('sent_at', { ascending: false });

    if (notificationError) {
      console.error('❌ Error fetching notifications:', notificationError);
    } else {
      console.log(`📊 Unread formal notifications: ${unreadNotifications?.length || 0}`);
      if (unreadNotifications && unreadNotifications.length > 0) {
        console.log('Recent unread notifications:');
        unreadNotifications.slice(0, 3).forEach((notif, idx) => {
          console.log(`  ${idx + 1}. Type: ${notif.notifications.type}`);
          console.log(`     Message: "${notif.notifications.message?.substring(0, 50)}..."`);
          console.log(`     Sent: ${new Date(notif.sent_at).toLocaleString()}`);
          console.log('');
        });
      }
    }

    // 3. Calculate totals (like UniversalNotificationService does)
    const messageCount = unreadMessages?.length || 0;
    const notificationCount = unreadNotifications?.length || 0;
    const totalCount = messageCount + notificationCount;

    console.log('\n📊 FINAL COUNTS BREAKDOWN');
    console.log('─────────────────────────────────────');
    console.log(`💬 Chat Messages (unread): ${messageCount}`);
    console.log(`🔔 Formal Notifications (unread): ${notificationCount}`);
    console.log(`🎯 TOTAL Badge Count: ${totalCount}`);
    console.log('═══════════════════════════════════════');

    // 4. Explain the discrepancy
    console.log('\n🔍 EXPLANATION');
    console.log('─────────────────────────────────────');
    
    if (totalCount === 0) {
      console.log('✅ Badge should show no count - everything is read');
    } else if (totalCount === 1) {
      if (messageCount === 1 && notificationCount === 0) {
        console.log('💡 Badge shows "1" because of 1 UNREAD CHAT MESSAGE');
        console.log('   - TeacherNotifications screen shows 0 because it only shows formal notifications');
        console.log('   - Check the Chat/Messages screen to see the unread message');
      } else if (messageCount === 0 && notificationCount === 1) {
        console.log('💡 Badge shows "1" because of 1 UNREAD FORMAL NOTIFICATION');
        console.log('   - TeacherNotifications screen should show 1 unread notification');
        console.log('   - If it shows 0, there might be a filtering issue in the screen');
      }
    } else {
      console.log(`💡 Badge shows "${totalCount}" from combination of:`);
      console.log(`   - ${messageCount} unread chat messages`);
      console.log(`   - ${notificationCount} unread formal notifications`);
    }

    console.log('\n📋 WHAT TO CHECK:');
    if (messageCount > 0) {
      console.log('🔹 Check Chat/Messages screens for unread messages');
    }
    if (notificationCount > 0) {
      console.log('🔹 Check TeacherNotifications screen - should show unread notifications');
    }
    if (totalCount === 0) {
      console.log('🔹 Badge should be hidden (or show 0 if showZero=true)');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Instructions
console.log(`
🛠️  HOW TO USE THIS SCRIPT:
════════════════════════════════════════════════

1. Replace TEACHER_USER_ID with actual teacher user ID
   
   To find the teacher user ID:
   - Login as teacher in browser
   - Open browser console (F12)
   - Look for "user.id" in AuthContext logs
   - Or check the users table in Supabase dashboard

2. Run the script:
   node debug_notification_count.js

3. The script will show you exactly what's contributing to the badge count

4. Common scenarios:
   - Badge: 1, Notifications: 0 → Unread chat message
   - Badge: 1, Notifications: 1 → Unread formal notification
   - Badge: 0, Notifications: 0 → Everything is read

5. To fix unread messages automatically, uncomment the fix section below

════════════════════════════════════════════════
`);

// Optional: Automatically mark messages as read (uncomment to use)
/*
async function markAllMessagesAsRead() {
  console.log('🔧 Marking all messages as read...');
  
  const { error } = await supabase
    .from(TABLES.MESSAGES)
    .update({ is_read: true })
    .eq('receiver_id', TEACHER_USER_ID)
    .eq('is_read', false);

  if (error) {
    console.error('❌ Error marking messages as read:', error);
  } else {
    console.log('✅ All messages marked as read successfully');
  }
}
*/

// Uncomment to run the debug immediately
// debugNotificationCount();

export { debugNotificationCount };
