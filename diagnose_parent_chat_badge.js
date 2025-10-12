#!/usr/bin/env node

/**
 * Standalone Parent Chat Badge Diagnostic Script
 * 
 * This script can be run independently to diagnose parent chat badge count issues.
 * It requires the parent user ID as a command line argument.
 * 
 * Usage:
 *   node diagnose_parent_chat_badge.js [parent_user_id]
 * 
 * Example:
 *   node diagnose_parent_chat_badge.js "550e8400-e29b-41d4-a716-446655440000"
 */

// Import required modules
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (same as in app)
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Table constants
const TABLES = {
  MESSAGES: 'messages',
  USERS: 'users',
  NOTIFICATION_RECIPIENTS: 'notification_recipients'
};

/**
 * Get tenant ID for a user by email lookup
 */
async function getTenantIdForUser(userEmail) {
  try {
    console.log(`🏢 Looking up tenant for user email: ${userEmail}`);
    
    const { data: userRecord, error } = await supabase
      .from(TABLES.USERS)
      .select('tenant_id, email')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Error querying users by email:', error);
      return null;
    }
    
    if (!userRecord) {
      console.warn('⚠️ No user record found for email:', userEmail);
      return null;
    }
    
    console.log(`✅ Found tenant ID: ${userRecord.tenant_id} for user: ${userEmail}`);
    return userRecord.tenant_id;
  } catch (error) {
    console.error('❌ Error getting tenant ID:', error);
    return null;
  }
}

/**
 * Main diagnostic function for parent chat badge issues
 */
async function diagnoseParentChatBadge(parentUserId) {
  console.log('🔍 Starting parent chat badge diagnosis...');
  console.log(`👤 Parent User ID: ${parentUserId}`);
  console.log(`⏰ Diagnosis Time: ${new Date().toISOString()}`);
  console.log('=' .repeat(60));
  
  const results = {
    timestamp: new Date().toISOString(),
    parentUserId,
    issues: [],
    recommendations: [],
    counts: {
      totalMessages: 0,
      unreadMessages: 0,
      crossTenantMessages: 0,
      notifications: 0
    },
    messages: []
  };

  try {
    // Step 1: Get parent's user information
    console.log('\n📋 Step 1: Getting parent user information...');
    const { data: parentUser, error: parentUserError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, tenant_id')
      .eq('id', parentUserId)
      .maybeSingle();

    if (parentUserError) {
      console.error('❌ Error fetching parent user:', parentUserError);
      results.issues.push(`Unable to fetch parent user: ${parentUserError.message}`);
      return results;
    }

    if (!parentUser) {
      console.error('❌ Parent user not found');
      results.issues.push('Parent user not found in database');
      return results;
    }

    console.log(`✅ Parent user found: ${parentUser.email}`);
    console.log(`🏢 Parent tenant ID: ${parentUser.tenant_id || 'NULL'}`);
    
    results.parentEmail = parentUser.email;
    results.parentTenantId = parentUser.tenant_id;

    // Step 2: Check all messages for this parent
    console.log('\n📨 Step 2: Checking all messages for parent...');
    const { data: allMessages, error: msgError } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, sender_id, receiver_id, is_read, message, sent_at, tenant_id, student_id, message_type')
      .eq('receiver_id', parentUserId)
      .order('sent_at', { ascending: false });

    if (msgError) {
      console.error('❌ Message query error:', msgError);
      results.issues.push(`Message query error: ${msgError.message}`);
      return results;
    }

    results.counts.totalMessages = allMessages?.length || 0;
    results.messages = allMessages || [];

    console.log(`📊 Total messages found: ${results.counts.totalMessages}`);

    // Step 3: Analyze unread messages
    console.log('\n📖 Step 3: Analyzing unread messages...');
    const unreadMessages = allMessages?.filter(msg => msg.is_read === false) || [];
    results.counts.unreadMessages = unreadMessages.length;

    console.log(`📊 Unread messages: ${results.counts.unreadMessages}`);

    if (unreadMessages.length > 0) {
      console.log('\n📝 Unread messages details:');
      unreadMessages.forEach((msg, index) => {
        console.log(`   ${index + 1}. ID: ${msg.id}`);
        console.log(`      Sender: ${msg.sender_id}`);
        console.log(`      Message: ${msg.message?.substring(0, 50)}...`);
        console.log(`      Sent: ${msg.sent_at}`);
        console.log(`      Tenant: ${msg.tenant_id || 'NULL'}`);
        console.log(`      Student: ${msg.student_id || 'NULL'}`);
        console.log('');
      });
    }

    // Step 4: Check for cross-tenant messages
    console.log('\n🏢 Step 4: Checking for cross-tenant messages...');
    if (parentUser.tenant_id) {
      const crossTenantMessages = unreadMessages.filter(msg => 
        msg.tenant_id && msg.tenant_id !== parentUser.tenant_id
      );
      
      results.counts.crossTenantMessages = crossTenantMessages.length;
      
      if (crossTenantMessages.length > 0) {
        console.log(`⚠️ Found ${crossTenantMessages.length} cross-tenant unread messages:`);
        
        crossTenantMessages.forEach((msg, index) => {
          console.log(`   ${index + 1}. Message ID: ${msg.id}`);
          console.log(`      Message Tenant: ${msg.tenant_id}`);
          console.log(`      Parent Tenant: ${parentUser.tenant_id}`);
          console.log(`      Sender: ${msg.sender_id}`);
          console.log(`      Sent: ${msg.sent_at}`);
          console.log('');
        });

        results.issues.push({
          type: 'cross_tenant_messages',
          count: crossTenantMessages.length,
          description: 'Found unread messages from different tenants affecting badge count',
          messages: crossTenantMessages.map(msg => ({
            id: msg.id,
            messageTenant: msg.tenant_id,
            parentTenant: parentUser.tenant_id,
            sender: msg.sender_id,
            sent: msg.sent_at
          }))
        });
        
        results.recommendations.push({
          type: 'fix_cross_tenant',
          action: 'Mark cross-tenant messages as read or filter them out',
          severity: 'high'
        });
      } else {
        console.log('✅ No cross-tenant messages found');
      }
    } else {
      console.log('⚠️ Parent has no tenant_id - cannot check for cross-tenant messages');
      results.issues.push('Parent user has no tenant_id assigned');
    }

    // Step 5: Check notifications
    console.log('\n🔔 Step 5: Checking notifications...');
    const { data: notifications, error: notifError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        notifications(
          id,
          message,
          type,
          tenant_id
        )
      `)
      .eq('recipient_id', parentUserId)
      .eq('is_read', false);

    if (!notifError) {
      results.counts.notifications = notifications?.length || 0;
      console.log(`📊 Unread notifications: ${results.counts.notifications}`);
      
      if (notifications && notifications.length > 0) {
        console.log('\n🔔 Unread notifications details:');
        notifications.forEach((notif, index) => {
          console.log(`   ${index + 1}. Recipient ID: ${notif.id}`);
          console.log(`      Type: ${notif.notifications?.type || 'Unknown'}`);
          console.log(`      Message: ${notif.notifications?.message?.substring(0, 50)}...`);
          console.log(`      Tenant: ${notif.notifications?.tenant_id || 'NULL'}`);
          console.log('');
        });
      }
    } else {
      console.error('❌ Error fetching notifications:', notifError);
    }

    // Step 6: Calculate expected badge count
    const expectedBadgeCount = results.counts.unreadMessages + results.counts.notifications;
    results.expectedBadgeCount = expectedBadgeCount;

    console.log(`\n🎯 Expected badge count: ${expectedBadgeCount}`);
    console.log(`   (${results.counts.unreadMessages} messages + ${results.counts.notifications} notifications)`);

    // Step 7: Provide recommendations
    console.log('\n💡 Step 7: Generating recommendations...');
    if (results.counts.unreadMessages === 0 && results.counts.notifications === 0) {
      results.recommendations.push({
        type: 'clear_cache',
        action: 'Clear badge cache and force refresh - badge should show 0',
        severity: 'medium'
      });
      console.log('✅ No unread items found - badge should be cleared');
    }

    if (results.counts.unreadMessages > 0) {
      results.recommendations.push({
        type: 'check_legitimacy',
        action: 'Verify if unread messages should actually be marked as read',
        severity: 'medium',
        details: `Found ${results.counts.unreadMessages} unread messages`
      });
    }

    // Step 8: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`👤 Parent User: ${parentUser.email} (${parentUserId})`);
    console.log(`🏢 Tenant ID: ${parentUser.tenant_id || 'NULL'}`);
    console.log(`📨 Total Messages: ${results.counts.totalMessages}`);
    console.log(`📖 Unread Messages: ${results.counts.unreadMessages}`);
    console.log(`🚨 Cross-Tenant Messages: ${results.counts.crossTenantMessages}`);
    console.log(`🔔 Unread Notifications: ${results.counts.notifications}`);
    console.log(`🎯 Expected Badge Count: ${expectedBadgeCount}`);
    console.log(`❗ Issues Found: ${results.issues.length}`);
    console.log(`💡 Recommendations: ${results.recommendations.length}`);
    
    if (results.issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      results.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${typeof issue === 'string' ? issue : issue.description || issue.type}`);
        if (issue.count) {
          console.log(`      Count: ${issue.count}`);
        }
      });
    }

    if (results.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      results.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.action}`);
        console.log(`      Severity: ${rec.severity}`);
        if (rec.details) {
          console.log(`      Details: ${rec.details}`);
        }
      });
    }

    console.log('\n✅ Diagnosis complete!');
    return results;

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    results.issues.push(`Diagnosis error: ${error.message}`);
    return results;
  }
}

/**
 * Main function
 */
async function main() {
  // Check for user ID argument
  const parentUserId = process.argv[2];
  
  if (!parentUserId) {
    console.error('❌ Error: Parent user ID is required');
    console.log('\nUsage:');
    console.log('  node diagnose_parent_chat_badge.js [parent_user_id]');
    console.log('\nExample:');
    console.log('  node diagnose_parent_chat_badge.js "550e8400-e29b-41d4-a716-446655440000"');
    process.exit(1);
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(parentUserId)) {
    console.error('❌ Error: Invalid UUID format for parent user ID');
    console.log('Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    process.exit(1);
  }

  console.log('🚀 Parent Chat Badge Diagnostic Tool');
  console.log('=====================================\n');

  try {
    const results = await diagnoseParentChatBadge(parentUserId);
    
    // Save results to file
    const fs = require('fs');
    const outputFile = `parent_chat_badge_diagnosis_${parentUserId}_${Date.now()}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\n💾 Detailed results saved to: ${outputFile}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { diagnoseParentChatBadge, getTenantIdForUser };