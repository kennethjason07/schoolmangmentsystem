import { supabase, TABLES } from '../utils/supabase';
import { getCurrentUserTenantByEmail } from '../utils/getTenantByEmail';

/**
 * Fee Reminder Notification Service
 * Handles sending fee reminders via in-app notifications and push notifications
 * with proper tenant filtering
 */
class FeeReminderNotificationService {
  constructor() {
    this.deliveryModes = {
      IN_APP: 'InApp',
      PUSH: 'Push'
    };

    this.recipientTypes = {
      PARENT: 'Parent',
      STUDENT: 'Student'
    };

    this.notificationTypes = {
      FEE_REMINDER: 'Fee Reminder'
    };
  }

  /**
   * Get current user's tenant context
   */
  async getTenantContext() {
    try {
      const result = await getCurrentUserTenantByEmail();
      if (!result.success) {
        console.error('❌ [FEE_REMINDER] Failed to get tenant context:', result.error);
        return { success: false, error: result.error };
      }
      
      return {
        success: true,
        tenantId: result.data.tenant.id,
        tenantName: result.data.tenant.name,
        userRecord: result.data.userRecord
      };
    } catch (error) {
      console.error('❌ [FEE_REMINDER] Error getting tenant context:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send fee reminders with push notifications
   * @param {Object} options - Reminder options
   * @param {string} options.message - Reminder message
   * @param {Array<string>} options.recipientTypes - ['Parent', 'Student']
   * @param {string|null} options.classId - Specific class ID or null for all classes
   * @param {Object} options.feeInfo - Fee information for personalization
   * @returns {Promise<Object>} Result with success status and stats
   */
  async sendFeeReminders(options) {
    const { message, recipientTypes = ['Parent'], classId = null, feeInfo = {} } = options;

    try {
      console.log('💰 [FEE_REMINDER] Starting fee reminder process...');
      
      // Get tenant context
      const tenantContext = await this.getTenantContext();
      if (!tenantContext.success) {
        throw new Error(`Tenant context error: ${tenantContext.error}`);
      }

      const { tenantId, tenantName, userRecord } = tenantContext;
      console.log(`💰 [FEE_REMINDER] Processing for tenant: ${tenantName} (${tenantId})`);

      // Step 1: Create main notification record
      const notificationData = {
        type: this.notificationTypes.FEE_REMINDER,
        message: message.trim(),
        delivery_mode: this.deliveryModes.IN_APP,
        delivery_status: 'Sent',
        sent_at: new Date().toISOString(),
        sent_by: userRecord?.id || null,
        tenant_id: tenantId,
        created_at: new Date().toISOString()
      };

      const { data: notificationResult, error: notificationError } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .insert(notificationData)
        .select('id')
        .single();

      if (notificationError) {
        console.error('❌ [FEE_REMINDER] Error creating notification:', notificationError);
        throw notificationError;
      }

      const notificationId = notificationResult.id;
      console.log('✅ [FEE_REMINDER] Created notification:', notificationId);

      // Step 2: Get recipients based on class and recipient types
      const recipients = await this.getRecipients(tenantId, classId, recipientTypes);
      console.log(`💰 [FEE_REMINDER] Found ${recipients.length} recipients`);

      if (recipients.length === 0) {
        console.warn('⚠️ [FEE_REMINDER] No recipients found');
        return {
          success: true,
          notificationId,
          recipientCount: 0,
          pushCount: 0,
          message: 'No recipients found for the selected criteria'
        };
      }

      // Step 3: Create notification recipients records
      const recipientRecords = recipients.map(recipient => ({
        notification_id: notificationId,
        recipient_id: recipient.userId,
        recipient_type: recipient.recipientType,
        delivery_status: 'Sent',
        sent_at: new Date().toISOString(),
        tenant_id: tenantId
      }));

      const { error: recipientsError } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .insert(recipientRecords);

      if (recipientsError) {
        console.error('❌ [FEE_REMINDER] Error creating recipients:', recipientsError);
        throw recipientsError;
      }

      console.log('✅ [FEE_REMINDER] Created recipient records');

      // Step 4: Get push tokens for recipients
      const userIds = recipients.map(r => r.userId);
      const pushTokens = await this.getPushTokens(tenantId, userIds);
      console.log(`📱 [FEE_REMINDER] Found ${pushTokens.length} active push tokens`);

      // Step 5: Send push notifications
      let pushSuccessCount = 0;
      if (pushTokens.length > 0) {
        pushSuccessCount = await this.sendPushNotifications(pushTokens, message, feeInfo);
      }

      console.log('✅ [FEE_REMINDER] Fee reminder process completed successfully');

      return {
        success: true,
        notificationId,
        recipientCount: recipients.length,
        pushCount: pushSuccessCount,
        message: `Fee reminders sent to ${recipients.length} recipients with ${pushSuccessCount} push notifications delivered`
      };

    } catch (error) {
      console.error('❌ [FEE_REMINDER] Error in sendFeeReminders:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get recipients based on tenant, class, and recipient types
   */
  async getRecipients(tenantId, classId, recipientTypes) {
    try {
      const recipients = [];

      if (classId) {
        // Get students from specific class
        const { data: students, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('class_id', classId);

        if (studentsError) throw studentsError;
        
        if (students && students.length > 0) {
          const studentIds = students.map(s => s.id);

          // Get parent users for these students
          if (recipientTypes.includes('Parent')) {
            const { data: parentUsers, error: parentError } = await supabase
              .from(TABLES.USERS)
              .select('id')
              .eq('tenant_id', tenantId)
              .in('linked_parent_of', studentIds);

            if (parentError) throw parentError;
            
            if (parentUsers) {
              recipients.push(...parentUsers.map(u => ({
                userId: u.id,
                recipientType: 'Parent'
              })));
            }
          }

          // Get student users
          if (recipientTypes.includes('Student')) {
            const { data: studentUsers, error: studentError } = await supabase
              .from(TABLES.USERS)
              .select('id')
              .eq('tenant_id', tenantId)
              .in('linked_student_id', studentIds);

            if (studentError) throw studentError;
            
            if (studentUsers) {
              recipients.push(...studentUsers.map(u => ({
                userId: u.id,
                recipientType: 'Student'
              })));
            }
          }
        }
      } else {
        // Get all parents/students in tenant
        if (recipientTypes.includes('Parent')) {
          const { data: parentUsers, error: parentError } = await supabase
            .from(TABLES.USERS)
            .select('id')
            .eq('tenant_id', tenantId)
            .not('linked_parent_of', 'is', null);

          if (parentError) throw parentError;
          
          if (parentUsers) {
            recipients.push(...parentUsers.map(u => ({
              userId: u.id,
              recipientType: 'Parent'
            })));
          }
        }

        if (recipientTypes.includes('Student')) {
          const { data: studentUsers, error: studentError } = await supabase
            .from(TABLES.USERS)
            .select('id')
            .eq('tenant_id', tenantId)
            .not('linked_student_id', 'is', null);

          if (studentError) throw studentError;
          
          if (studentUsers) {
            recipients.push(...studentUsers.map(u => ({
              userId: u.id,
              recipientType: 'Student'
            })));
          }
        }
      }

      // Remove duplicates (in case a user is both parent and student)
      const uniqueRecipients = recipients.filter((recipient, index, self) =>
        index === self.findIndex(r => r.userId === recipient.userId)
      );

      return uniqueRecipients;

    } catch (error) {
      console.error('❌ [FEE_REMINDER] Error getting recipients:', error);
      throw error;
    }
  }

  /**
   * Get active push tokens for users
   */
  async getPushTokens(tenantId, userIds) {
    try {
      if (userIds.length === 0) return [];

      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select(`
          token,
          user_id,
          device_type,
          users!inner(tenant_id)
        `)
        .in('user_id', userIds)
        .eq('is_active', true)
        .eq('users.tenant_id', tenantId); // Ensure tenant filtering

      if (tokensError) {
        console.error('❌ [FEE_REMINDER] Error getting push tokens:', tokensError);
        throw tokensError;
      }

      return tokens || [];

    } catch (error) {
      console.error('❌ [FEE_REMINDER] Error in getPushTokens:', error);
      throw error;
    }
  }

  /**
   * Send push notifications to devices
   */
  async sendPushNotifications(pushTokens, message, feeInfo = {}) {
    try {
      const { totalOutstanding = 0, dueDate = null } = feeInfo;

      // Prepare push notification content
      const pushTitle = '💰 Fee Payment Reminder';
      
      let pushBody = message;
      if (pushBody.length > 100) {
        pushBody = pushBody.substring(0, 100) + '...';
      }

      // Create push notifications for each token
      const pushNotifications = pushTokens.map(tokenData => ({
        to: tokenData.token,
        sound: 'default',
        title: pushTitle,
        body: pushBody,
        data: {
          type: 'fee_reminder',
          notificationType: 'Fee Reminder',
          priority: 'high',
          totalOutstanding,
          dueDate,
          timestamp: Date.now()
        },
        android: {
          channelId: 'fee-notifications',
          priority: 'high',
          color: '#FF9800', // Orange color for fees
          sticky: false
        },
        ios: {
          sound: 'default',
          badge: 1,
          categoryId: 'FEE_REMINDER'
        }
      }));

      console.log(`📤 [FEE_REMINDER] Sending ${pushNotifications.length} push notifications...`);

      // Send to Expo push service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushNotifications),
      });

      const result = await response.json();
      console.log('📤 [FEE_REMINDER] Push notification response:', result);

      // Count successful sends
      const successCount = result.data?.filter(r => r.status === 'ok').length || 0;
      const errorCount = result.data?.filter(r => r.status === 'error').length || 0;

      if (errorCount > 0) {
        console.warn(`⚠️ [FEE_REMINDER] ${errorCount} push notifications failed`);
      }

      console.log(`✅ [FEE_REMINDER] Push notifications sent successfully to ${successCount}/${pushNotifications.length} devices`);

      return successCount;

    } catch (error) {
      console.error('❌ [FEE_REMINDER] Error sending push notifications:', error);
      return 0;
    }
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }
}

// Export singleton instance
const feeReminderNotificationService = new FeeReminderNotificationService();
export default feeReminderNotificationService;