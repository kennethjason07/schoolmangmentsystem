import { supabase, TABLES } from '../utils/supabase';
import { getCachedTenantId, createTenantQuery } from '../utils/tenantHelpers';
import pushNotificationService from './PushNotificationService';

/**
 * Chat Push Notification Service
 * Handles push notifications specifically for chat messages between teachers, parents, and students
 * Integrates with the existing PushNotificationService
 */
class ChatPushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.soundMap = {
      'teacher': 'vidya_setu_message.mp3',
      'parent': 'vidya_setu_message.mp3', 
      'student': 'vidya_setu_message.mp3'
    };
  }

  /**
   * Initialize the chat notification service
   */
  async initialize() {
    try {
      this.isInitialized = true;
      console.log('✅ ChatPushNotificationService initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ ChatPushNotificationService initialization failed:', error);
      return false;
    }
  }

  /**
   * Get user information including name and type
   * @param {string} userId - User ID to get information for
   * @param {string} tenantId - Tenant ID for filtering
   * @returns {Promise<Object|null>} User information
   */
  async getUserInfo(userId, tenantId) {
    try {
      if (!userId || !tenantId) {
        console.warn('Missing userId or tenantId for getUserInfo');
        return null;
      }

      const { data: userInfo, error } = await createTenantQuery(
        tenantId,
        TABLES.USERS,
        'id, full_name, email, role_id, roles(role_name), linked_teacher_id, linked_parent_of, linked_student_id'
      ).eq('id', userId).single();

      if (error || !userInfo) {
        console.warn(`Could not fetch user info for ${userId}:`, error);
        return null;
      }

      const userRecord = Array.isArray(userInfo) ? userInfo[0] : userInfo;
      
      // Safety check for userRecord
      if (!userRecord) {
        console.warn(`User record is null for ${userId}`);
        return null;
      }
      
      // Determine user type and name with null safety
      let userType = 'user';
      let displayName = userRecord.full_name || userRecord.email || 'Unknown User';

      // Safe check for roles with null safety
      if (userRecord.roles && userRecord.roles.role_name) {
        userType = userRecord.roles.role_name.toLowerCase();
      } else if (userRecord.linked_teacher_id) {
        userType = 'teacher';
      } else if (userRecord.linked_parent_of) {
        userType = 'parent';
      } else if (userRecord.linked_student_id) {
        userType = 'student';
      }

      // If parent, get student name for better context with null safety
      if (userType === 'parent' && userRecord.linked_parent_of) {
        try {
          const { data: studentInfo } = await createTenantQuery(
            tenantId,
            TABLES.STUDENTS,
            'name'
          ).eq('id', userRecord.linked_parent_of).single();
          
          if (studentInfo) {
            const student = Array.isArray(studentInfo) ? studentInfo[0] : studentInfo;
            if (student && student.name) {
              displayName = `${displayName} (${student.name}'s parent)`;
            }
          }
        } catch (err) {
          // Ignore error and use regular name
          console.warn('Could not fetch student name for parent context:', err);
        }
      }

      return {
        id: userId,
        name: displayName,
        email: userRecord.email || 'no-email@example.com',
        type: userType,
        rawRole: userRecord.roles?.role_name || null
      };
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  /**
   * Get active push tokens for a user
   * @param {string} userId - User ID to get tokens for
   * @param {string} tenantId - Tenant ID for filtering
   * @returns {Promise<Array>} Array of active push tokens
   */
  async getUserPushTokens(userId, tenantId) {
    try {
      if (!userId) return [];

      // Query push tokens table
      let query = supabase
        .from('push_tokens')
        .select('token, platform, device_info')
        .eq('user_id', userId)
        .eq('is_active', true);

      // Apply tenant filtering if available
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: tokens, error } = await query;

      if (error) {
        console.warn(`Error fetching push tokens for user ${userId}:`, error);
        return [];
      }

      return tokens || [];
    } catch (error) {
      console.error('Error getting user push tokens:', error);
      return [];
    }
  }

  /**
   * Send chat message push notification to a specific recipient
   * @param {Object} params - Notification parameters
   * @param {string} params.senderId - ID of the message sender
   * @param {string} params.receiverId - ID of the message receiver
   * @param {string} params.message - Message content
   * @param {string} params.messageType - Type of message (text, image, file, etc.)
   * @param {string} params.studentId - Related student ID (for context)
   * @returns {Promise<boolean>} Success status
   */
  async sendChatMessageNotification({ 
    senderId, 
    receiverId, 
    message, 
    messageType = 'text',
    studentId = null 
  }) {
    try {
      console.log(`📤 [ChatPushNotificationService] Sending chat notification from ${senderId} to ${receiverId}`);

      if (!senderId || !receiverId || senderId === receiverId) {
        console.warn('Invalid sender or receiver ID');
        return false;
      }

      // Get tenant context
      const tenantId = getCachedTenantId();
      if (!tenantId) {
        console.warn('No tenant context available for push notification');
        return false;
      }

      // Get sender and receiver information in parallel
      const [senderInfo, receiverInfo] = await Promise.all([
        this.getUserInfo(senderId, tenantId),
        this.getUserInfo(receiverId, tenantId)
      ]);

      if (!senderInfo || !receiverInfo) {
        console.warn('Could not get sender or receiver information', {
          senderInfo: senderInfo ? 'found' : 'null',
          receiverInfo: receiverInfo ? 'found' : 'null',
          senderId,
          receiverId
        });
        return false;
      }

      // Additional safety checks
      if (!senderInfo.name || !receiverInfo.type) {
        console.warn('Sender or receiver missing required properties', {
          senderName: senderInfo.name,
          receiverType: receiverInfo.type
        });
        return false;
      }

      // Get receiver's push tokens
      const tokens = await this.getUserPushTokens(receiverId, tenantId);
      if (!tokens || tokens.length === 0) {
        console.log(`No push tokens found for user ${receiverId}`);
        return false;
      }

      // Prepare notification title and body
      const title = `New message from ${senderInfo.name}`;
      let body = message || '';

      // Handle different message types
      if (messageType === 'image') {
        body = '📷 Image';
      } else if (messageType === 'file') {
        body = '📎 File attachment';
      } else if (messageType === 'audio') {
        body = '🎵 Audio message';
      } else {
        // Truncate long text messages
        if (body && body.length > 100) {
          body = body.substring(0, 100) + '...';
        }
      }

      // Add context for parent notifications
      if (receiverInfo.type === 'parent' && studentId) {
        try {
          const { data: studentInfo } = await createTenantQuery(
            tenantId,
            TABLES.STUDENTS,
            'name'
          ).eq('id', studentId).single();
          
          if (studentInfo) {
            const student = Array.isArray(studentInfo) ? studentInfo[0] : studentInfo;
            body = `[${student.name}] ${body}`;
          }
        } catch (err) {
          // Ignore error
        }
      }

      // Prepare notification payload for each token
      const notifications = tokens.map(tokenRecord => ({
        to: tokenRecord.token,
        sound: this.soundMap[receiverInfo.type] || 'default',
        title,
        body,
        data: {
          type: 'chat_message',
          senderId: senderId,
          senderName: senderInfo.name,
          senderType: senderInfo.type,
          receiverId: receiverId,
          messageType: messageType,
          studentId: studentId,
          chatId: `${senderId}_${receiverId}`,
          timestamp: Date.now(),
          tenantId: tenantId
        },
        android: {
          channelId: 'chat-messages',
          priority: 'high',
          sticky: false,
          color: '#2196F3'
        },
        ios: {
          sound: this.soundMap[receiverInfo.type] || 'default',
          badge: 1, // Will be updated with actual count
          category: 'chat_message'
        }
      }));

      // Send notifications via Expo's push service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notifications),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [ChatPushNotificationService] Chat notification sent successfully:`, result);

      // Log delivery details
      if (Array.isArray(result.data)) {
        const successful = result.data.filter(item => item.status === 'ok').length;
        const failed = result.data.filter(item => item.status === 'error').length;
        console.log(`📊 [ChatPushNotificationService] Delivery stats: ${successful} successful, ${failed} failed`);
      }

      return true;
    } catch (error) {
      console.error('❌ [ChatPushNotificationService] Error sending chat notification:', error);
      return false;
    }
  }

  /**
   * Send push notification when teacher sends message to parent or student
   * @param {Object} params - Teacher message parameters
   */
  async sendTeacherMessageNotification({
    teacherId,
    recipientId,
    recipientType, // 'parent' or 'student'
    message,
    messageType = 'text',
    studentId = null
  }) {
    return await this.sendChatMessageNotification({
      senderId: teacherId,
      receiverId: recipientId,
      message,
      messageType,
      studentId
    });
  }

  /**
   * Send push notification when parent sends message to teacher
   * @param {Object} params - Parent message parameters
   */
  async sendParentMessageNotification({
    parentId,
    teacherId,
    message,
    messageType = 'text',
    studentId = null
  }) {
    return await this.sendChatMessageNotification({
      senderId: parentId,
      receiverId: teacherId,
      message,
      messageType,
      studentId
    });
  }

  /**
   * Send push notification when student sends message to teacher
   * @param {Object} params - Student message parameters
   */
  async sendStudentMessageNotification({
    studentUserId,
    teacherId,
    message,
    messageType = 'text',
    studentId = null
  }) {
    return await this.sendChatMessageNotification({
      senderId: studentUserId,
      receiverId: teacherId,
      message,
      messageType,
      studentId
    });
  }

  /**
   * Check if user has chat notifications enabled
   * @param {string} userId - User ID to check
   * @returns {Promise<boolean>} Whether chat notifications are enabled
   */
  async isChatNotificationEnabled(userId) {
    try {
      const { data: settings } = await supabase
        .from('user_notification_settings')
        .select('chat_messages')
        .eq('user_id', userId)
        .single();

      return settings?.chat_messages !== false; // Default to enabled if no settings
    } catch (error) {
      // If no settings found, default to enabled
      return true;
    }
  }

  /**
   * Bulk send notifications to multiple recipients
   * @param {Object} params - Bulk notification parameters
   * @param {string} params.senderId - Sender user ID
   * @param {Array} params.recipients - Array of recipient objects {id, type, studentId}
   * @param {string} params.message - Message content
   * @param {string} params.messageType - Message type
   * @returns {Promise<Array>} Array of results
   */
  async sendBulkChatNotifications({
    senderId,
    recipients = [],
    message,
    messageType = 'text'
  }) {
    console.log(`📤 [ChatPushNotificationService] Sending bulk notifications from ${senderId} to ${recipients.length} recipients`);

    const results = [];
    
    for (const recipient of recipients) {
      try {
        const result = await this.sendChatMessageNotification({
          senderId,
          receiverId: recipient.id,
          message,
          messageType,
          studentId: recipient.studentId || null
        });
        
        results.push({
          recipientId: recipient.id,
          success: result
        });
      } catch (error) {
        console.error(`Failed to send notification to ${recipient.id}:`, error);
        results.push({
          recipientId: recipient.id,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`📊 [ChatPushNotificationService] Bulk notification results: ${successful} successful, ${failed} failed`);

    return results;
  }

  /**
   * Handle notification when a message is read (to update badges)
   * @param {string} userId - User who read the message
   * @param {string} senderId - Original message sender
   */
  async handleMessageRead(userId, senderId) {
    try {
      // This could be used to update badge counts or send read receipts
      console.log(`📖 [ChatPushNotificationService] Message read by ${userId} from ${senderId}`);
      
      // Future enhancement: Update badge counts or send read receipts
      // For now, we'll let the UniversalNotificationService handle this
    } catch (error) {
      console.error('Error handling message read:', error);
    }
  }

  /**
   * Get notification statistics
   * @param {string} userId - User ID to get stats for
   * @returns {Promise<Object>} Notification statistics
   */
  async getNotificationStats(userId) {
    try {
      const tenantId = getCachedTenantId();
      if (!tenantId) return {};

      // Get push token count
      const tokens = await this.getUserPushTokens(userId, tenantId);
      
      return {
        userId,
        activeTokens: tokens.length,
        platforms: tokens.map(t => t.platform),
        isEnabled: await this.isChatNotificationEnabled(userId)
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {};
    }
  }

  /**
   * Test notification sending (for debugging)
   * @param {string} userId - User ID to send test notification to
   * @returns {Promise<boolean>} Success status
   */
  async sendTestNotification(userId) {
    return await this.sendChatMessageNotification({
      senderId: 'system',
      receiverId: userId,
      message: 'This is a test notification from the chat system.',
      messageType: 'text'
    });
  }

  /**
   * Cleanup and dispose of resources
   */
  cleanup() {
    this.isInitialized = false;
    console.log('🧹 ChatPushNotificationService cleaned up');
  }
}

// Export singleton instance
export const chatPushNotificationService = new ChatPushNotificationService();
export default chatPushNotificationService;