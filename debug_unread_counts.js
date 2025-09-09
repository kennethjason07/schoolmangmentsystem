// Debug script to check unread message counts
// Run this to diagnose why badge shows count but no unread messages

import { supabase, TABLES } from './src/utils/supabase.js';

// Replace with actual teacher user ID
const TEACHER_USER_ID = 'your-teacher-user-id-here';

async function debugUnreadCounts() {
  console.log('🔍 Starting unread message count debugging...');
  console.log('Teacher User ID:', TEACHER_USER_ID);

  try {
    // 1. Check all messages for this user
    console.log('\n📨 STEP 1: All messages for this teacher');
    const { data: allMessages, error: allError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, receiver_id, is_read, message, sent_at')
      .eq('receiver_id', TEACHER_USER_ID)
      .order('sent_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all messages:', allError);
      return;
    }

    console.log(`📊 Total messages: ${allMessages?.length || 0}`);
    allMessages?.slice(0, 10).forEach((msg, idx) => {
      console.log(`  ${idx + 1}. ID: ${msg.id}, From: ${msg.sender_id}, Read: ${msg.is_read}, Message: "${msg.message?.substring(0, 50)}..."`);
    });

    // 2. Check specifically unread messages
    console.log('\n📬 STEP 2: Unread messages only');
    const { data: unreadMessages, error: unreadError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, receiver_id, is_read, message, sent_at')
      .eq('receiver_id', TEACHER_USER_ID)
      .eq('is_read', false)
      .order('sent_at', { ascending: false });

    if (unreadError) {
      console.error('❌ Error fetching unread messages:', unreadError);
      return;
    }

    console.log(`📊 Unread messages: ${unreadMessages?.length || 0}`);
    unreadMessages?.forEach((msg, idx) => {
      console.log(`  ${idx + 1}. ID: ${msg.id}, From: ${msg.sender_id}, Message: "${msg.message?.substring(0, 50)}..."`);
    });

    // 3. Check notification recipients
    console.log('\n🔔 STEP 3: Notification recipients');
    const { data: notificationRecipients, error: notifError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        recipient_id,
        recipient_type,
        notifications(
          id,
          message,
          type
        )
      `)
      .eq('recipient_id', TEACHER_USER_ID)
      .eq('recipient_type', 'Teacher')
      .eq('is_read', false);

    if (notifError) {
      console.error('❌ Error fetching notifications:', notifError);
      return;
    }

    console.log(`📊 Unread notifications: ${notificationRecipients?.length || 0}`);
    notificationRecipients?.forEach((notif, idx) => {
      console.log(`  ${idx + 1}. ID: ${notif.id}, Message: "${notif.notifications?.message?.substring(0, 50)}..."`);
    });

    // 4. Test the UniversalNotificationService directly
    console.log('\n🔧 STEP 4: Testing UniversalNotificationService');
    
    // Simulate the service calls
    const messageCount = unreadMessages?.length || 0;
    const notificationCount = notificationRecipients?.length || 0;
    const totalCount = messageCount + notificationCount;

    console.log(`📊 Counts breakdown:`);
    console.log(`  - Messages: ${messageCount}`);
    console.log(`  - Notifications: ${notificationCount}`);
    console.log(`  - Total: ${totalCount}`);

    // 5. If there are unread messages that shouldn't be unread, show them
    if (unreadMessages?.length > 0) {
      console.log('\n⚠️ POTENTIAL ISSUE: Found unread messages that might need to be marked as read:');
      unreadMessages.forEach((msg) => {
        console.log(`  - Message ID: ${msg.id}`);
        console.log(`    From: ${msg.sender_id}`);
        console.log(`    Content: "${msg.message}"`);
        console.log(`    Sent: ${msg.sent_at}`);
        console.log(`    Is Read: ${msg.is_read}`);
        console.log('');
      });

      // Optional: Mark them as read (uncomment to execute)
      /*
      console.log('🔧 Marking messages as read...');
      const { error: updateError } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('receiver_id', TEACHER_USER_ID)
        .eq('is_read', false);

      if (updateError) {
        console.error('❌ Error marking messages as read:', updateError);
      } else {
        console.log('✅ All messages marked as read successfully');
      }
      */
    }

    console.log('\n🎯 SUMMARY:');
    console.log(`Badge should show: ${totalCount}`);
    if (totalCount === 0) {
      console.log('✅ Badge should show no count - this is correct if you see no unread messages');
    } else if (totalCount === 1) {
      if (messageCount === 1) {
        console.log('📨 Badge shows 1 due to 1 unread message');
      } else if (notificationCount === 1) {
        console.log('🔔 Badge shows 1 due to 1 unread notification');
      }
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Instructions for use:
console.log(`
🔧 DEBUG INSTRUCTIONS:
1. Replace TEACHER_USER_ID with the actual teacher's user ID
2. Run this script: node debug_unread_counts.js
3. Check the output to see what's causing the badge count

To get the teacher user ID:
- Check the browser console when logged in as teacher
- Look for user.id in AuthContext logs
- Or check the users table in Supabase dashboard

To mark messages as read automatically:
- Uncomment the marked section in the script
`);

// Uncomment to run immediately (after setting TEACHER_USER_ID)
// debugUnreadCounts();

export { debugUnreadCounts };
