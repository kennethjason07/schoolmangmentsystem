import { supabase, TABLES, getUserTenantId } from './supabase';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * Test function to create a notification for all admin users
 * This helps test the real-time notification system for admin dashboard
 */
export async function createTestAdminNotification() {
  try {
    console.log('🧪 [ADMIN TEST] Creating test notification for all admin users...');
    
    // Get tenant_id for the notification
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      console.error('❌ [ADMIN TEST] No tenant_id found for notification creation');
      return {
        success: false,
        error: 'Tenant information not found'
      };
    }

    const testMessage = `[TEST] Admin notification test - ${new Date().toLocaleString()}`;
    
    // Step 1: Create the main notification record
    const { data: notification, error: notificationError } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .insert({
        message: testMessage,
        type: 'General',
        sent_by: null, // System generated
        delivery_mode: 'InApp',
        delivery_status: 'Sent',
        tenant_id: tenantId,
        scheduled_at: new Date().toISOString()
      })
      .select()
      .single();

    if (notificationError) {
      console.error('❌ [ADMIN TEST] Error creating notification:', notificationError);
      throw notificationError;
    }

    console.log('✅ [ADMIN TEST] Notification created:', notification.id);

    // Step 2: Get all admin users (role_id = 1)
    const { data: adminUsers, error: adminError } = await supabase
      .from(TABLES.USERS)
      .select('id, email, full_name')
      .eq('role_id', 1);
    
    if (adminError) {
      console.error('❌ [ADMIN TEST] Error fetching admin users:', adminError);
      throw adminError;
    }

    console.log(`📧 [ADMIN TEST] Found ${adminUsers?.length || 0} admin users:`, 
      adminUsers?.map(u => u.email));

    // Step 3: Create notification recipients for all admins
    if (adminUsers && adminUsers.length > 0) {
      const adminRecipients = adminUsers.map(admin => ({
        notification_id: notification.id,
        recipient_id: admin.id,
        recipient_type: 'Admin',
        delivery_status: 'Sent',
        sent_at: new Date().toISOString(),
        is_read: false,
        tenant_id: tenantId
      }));
      
      const { error: recipientsError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .insert(adminRecipients);
      
      if (recipientsError) {
        console.error('❌ [ADMIN TEST] Error creating admin notification recipients:', recipientsError);
        throw recipientsError;
      }

      console.log(`✅ [ADMIN TEST] Created notification recipients for ${adminUsers.length} admin users`);
    
      // Step 4: Broadcast real-time notification updates to all admin users
      try {
        console.log(`📡 [ADMIN TEST] Broadcasting real-time updates to ${adminUsers.length} admin users...`);
        const adminUserIds = adminUsers.map(admin => admin.id);
        
        console.log(`📡 [ADMIN TEST] Admin user IDs:`, adminUserIds);
        console.log(`📡 [ADMIN TEST] Notification ID:`, notification.id);
        console.log(`📡 [ADMIN TEST] About to broadcast to universal service...`);
        
        await universalNotificationService.broadcastNewNotificationToUsers(
          adminUserIds,
          notification.id,
          'General'
        );
        console.log(`✅ [ADMIN TEST] broadcastNewNotificationToUsers completed`);
        
        // Also handle individual recipient notifications
        console.log(`📡 [ADMIN TEST] Starting individual notification handling for ${adminUsers.length} users...`);
        for (const adminUser of adminUsers) {
          console.log(`📡 [ADMIN TEST] Handling notification for user: ${adminUser.id} (${adminUser.email})`);
          await universalNotificationService.handleNewNotificationRecipient(
            adminUser.id,
            notification.id,
            'admin'
          );
          console.log(`✅ [ADMIN TEST] Completed handling for user: ${adminUser.id}`);
        }
        console.log(`✅ [ADMIN TEST] Individual notification handling completed`);
        
        // Additional debugging - check Supabase real-time status
        console.log(`📞 [ADMIN TEST] Checking Supabase real-time connection...`);
        const { data: { session } } = await supabase.auth.getSession();
        console.log(`📞 [ADMIN TEST] Auth session exists:`, !!session);
        
      } catch (broadcastError) {
        console.error(`❌ [ADMIN TEST] Broadcasting failed:`, broadcastError);
        console.error(`❌ [ADMIN TEST] Error details:`, {
          message: broadcastError.message,
          stack: broadcastError.stack
        });
      }
    }

    return {
      success: true,
      notification,
      recipientCount: adminUsers?.length || 0,
      adminUsers: adminUsers?.map(u => ({ id: u.id, email: u.email }))
    };

  } catch (error) {
    console.error('❌ [ADMIN TEST] Error in createTestAdminNotification:', error);
    return {
      success: false,
      error: error.message || 'Failed to create test admin notification'
    };
  }
}

/**
 * Test function to check admin notification counts
 */
export async function checkAdminNotificationCounts(adminUserId) {
  try {
    console.log('🔍 [ADMIN TEST] Checking notification counts for admin:', adminUserId);
    
    const tenantId = await getUserTenantId();
    if (!tenantId) {
      return { error: 'No tenant found' };
    }

    // Check notification recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        id,
        is_read,
        recipient_type,
        notifications(
          id,
          message,
          type,
          created_at
        )
      `)
      .eq('recipient_id', adminUserId)
      .eq('recipient_type', 'Admin')
      .eq('tenant_id', tenantId)
      .order('created_at', { foreignTable: 'notifications', ascending: false })
      .limit(10);

    if (recipientsError) {
      console.error('❌ [ADMIN TEST] Error fetching recipients:', recipientsError);
      return { error: recipientsError.message };
    }

    const unreadCount = recipients?.filter(r => !r.is_read).length || 0;
    const totalCount = recipients?.length || 0;

    console.log('📊 [ADMIN TEST] Admin notification stats:', {
      adminUserId,
      totalNotifications: totalCount,
      unreadCount,
      recentNotifications: recipients?.slice(0, 3).map(r => ({
        id: r.id,
        message: r.notifications?.message?.substring(0, 50) + '...',
        isRead: r.is_read
      }))
    });

    return {
      success: true,
      totalCount,
      unreadCount,
      recipients
    };

  } catch (error) {
    console.error('❌ [ADMIN TEST] Error checking counts:', error);
    return { error: error.message };
  }
}

export default {
  createTestAdminNotification,
  checkAdminNotificationCounts
};
