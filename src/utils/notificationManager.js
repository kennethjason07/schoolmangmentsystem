import { enhancedNotificationService } from '../services/enhancedNotificationService';
import { supabase, TABLES } from './supabase';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';
import { getUserTenantFilteredNotifications, getTenantFilteredUnreadCount, markTenantNotificationAsRead } from './tenantNotificationFilter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * Notification Manager Utility for React Native App
 * Provides UI-level notification management functions and delivery mechanisms
 * Implements email-based tenant system for multi-tenant isolation
 */

/**
 * Tenant validation and context management for notifications
 */
export const TenantNotificationUtils = {
  /**
   * Get current user's tenant information using email-based lookup
   * @returns {Promise<Object>} Tenant information or error
   */
  async getCurrentUserTenant() {
    try {
      const result = await getCurrentUserTenantByEmail();
      if (!result.success) {
        console.error('❌ [TENANT_NOTIF] Failed to get current tenant:', result.error);
        return { success: false, error: result.error };
      }
      
      console.log('✅ [TENANT_NOTIF] Current tenant:', result.data.tenant.name);
      return {
        success: true,
        tenantId: result.data.tenant.id,
        tenantName: result.data.tenant.name,
        userRecord: result.data.userRecord
      };
    } catch (error) {
      console.error('❌ [TENANT_NOTIF] Error getting current tenant:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Validate that a notification belongs to the current user's tenant
   * @param {string} notificationId - Notification ID to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateNotificationAccess(notificationId) {
    try {
      const tenantResult = await this.getCurrentUserTenant();
      if (!tenantResult.success) {
        return { isValid: false, error: tenantResult.error };
      }

      // Check if notification belongs to current tenant
      const { data: notification, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('id, tenant_id, type')
        .eq('id', notificationId)
        .eq('tenant_id', tenantResult.tenantId)
        .single();

      if (error) {
        console.error('❌ [TENANT_NOTIF] Error validating notification access:', error);
        return { isValid: false, error: error.message };
      }

      if (!notification) {
        return { isValid: false, error: 'Notification not found or access denied' };
      }

      return { isValid: true, notification, tenantId: tenantResult.tenantId };
    } catch (error) {
      console.error('❌ [TENANT_NOTIF] Error in validateNotificationAccess:', error);
      return { isValid: false, error: error.message };
    }
  },

  /**
   * Get all users for the current tenant (for recipient selection)
   * @returns {Promise<Array>} List of users in current tenant
   */
  async getTenantUsers() {
    try {
      const tenantResult = await this.getCurrentUserTenant();
      if (!tenantResult.success) {
        return { success: false, error: tenantResult.error, users: [] };
      }

      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, full_name, role_id')
        .eq('tenant_id', tenantResult.tenantId);

      if (error) {
        console.error('❌ [TENANT_NOTIF] Error fetching tenant users:', error);
        return { success: false, error: error.message, users: [] };
      }

      console.log(`✅ [TENANT_NOTIF] Found ${users?.length || 0} users in tenant`);
      return {
        success: true,
        users: users || [],
        tenantId: tenantResult.tenantId,
        tenantName: tenantResult.tenantName
      };
    } catch (error) {
      console.error('❌ [TENANT_NOTIF] Error in getTenantUsers:', error);
      return { success: false, error: error.message, users: [] };
    }
  }
};

/**
 * Notification delivery mechanisms
 */
export const DELIVERY_MODES = {
  IN_APP: 'InApp',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp'
};

/**
 * Notification types for UI handling
 */
export const NOTIFICATION_TYPES = {
  GRADE_ENTERED: 'GRADE_ENTERED',
  HOMEWORK_UPLOADED: 'HOMEWORK_UPLOADED',
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  EVENT_CREATED: 'EVENT_CREATED'
};

/**
 * Get icon for notification type
 * @param {string} notificationType - The notification type
 * @returns {string} Icon name for the notification
 */
export function getNotificationIcon(notificationType) {
  const iconMap = {
    [NOTIFICATION_TYPES.GRADE_ENTERED]: '🎯',
    [NOTIFICATION_TYPES.HOMEWORK_UPLOADED]: '📚',
    [NOTIFICATION_TYPES.ATTENDANCE_MARKED]: '✅',
    [NOTIFICATION_TYPES.ANNOUNCEMENT]: '📢',
    [NOTIFICATION_TYPES.EVENT_CREATED]: '📅'
  };
  
  return iconMap[notificationType] || '🔔';
}

/**
 * Get color for notification type
 * @param {string} notificationType - The notification type
 * @returns {string} Color code for the notification
 */
export function getNotificationColor(notificationType) {
  const colorMap = {
    [NOTIFICATION_TYPES.GRADE_ENTERED]: '#FF6B35',
    [NOTIFICATION_TYPES.HOMEWORK_UPLOADED]: '#4ECDC4',
    [NOTIFICATION_TYPES.ATTENDANCE_MARKED]: '#45B7D1',
    [NOTIFICATION_TYPES.ANNOUNCEMENT]: '#96CEB4',
    [NOTIFICATION_TYPES.EVENT_CREATED]: '#FFEAA7'
  };
  
  return colorMap[notificationType] || '#BDC3C7';
}

/**
 * Format notification message for display
 * @param {Object} notification - Notification object
 * @returns {string} Formatted message
 */
export function formatNotificationMessage(notification) {
  if (!notification || !notification.message) {
    return 'New notification';
  }

  // Truncate long messages for preview
  const maxLength = 100;
  if (notification.message.length > maxLength) {
    return notification.message.substring(0, maxLength) + '...';
  }

  return notification.message;
}

/**
 * Format notification timestamp
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Human readable timestamp
 */
export function formatNotificationTime(timestamp) {
  if (!timestamp) return '';

  const now = new Date();
  const notificationDate = new Date(timestamp);
  const diffMs = now - notificationDate;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return notificationDate.toLocaleDateString();
}

/**
 * InApp notification delivery implementation
 * Shows local notifications and updates UI
 */
export class InAppDelivery {
  static async deliver(notification, recipients) {
    try {
      console.log('📱 [IN_APP] Delivering in-app notification:', notification.id);

      // Store notification locally for immediate UI update
      await this.storeLocalNotification(notification);

      // Show push notification if app is in background
      // This would typically use expo-notifications or similar
      if (typeof window !== 'undefined' && 'Notification' in window) {
        await this.showBrowserNotification(notification);
      }

      // Update badge count
      await this.updateBadgeCount();

      return {
        success: true,
        deliveredCount: recipients.length,
        method: 'in-app'
      };

    } catch (error) {
      console.error('❌ [IN_APP] Error delivering in-app notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async storeLocalNotification(notification) {
    try {
      const key = `notification_${notification.id}`;
      await AsyncStorage.setItem(key, JSON.stringify({
        ...notification,
        localDeliveredAt: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ [LOCAL_STORAGE] Error storing notification:', error);
    }
  }

  static async showBrowserNotification(notification) {
    if (Notification.permission === 'granted') {
      new Notification(this.getNotificationTitle(notification.type), {
        body: formatNotificationMessage(notification),
        icon: '/icon-notification.png', // Add your app icon
        badge: '/badge-icon.png'
      });
    }
  }

  static getNotificationTitle(type) {
    const titleMap = {
      [NOTIFICATION_TYPES.GRADE_ENTERED]: 'New Marks Entered',
      [NOTIFICATION_TYPES.HOMEWORK_UPLOADED]: 'New Homework Assigned',
      [NOTIFICATION_TYPES.ATTENDANCE_MARKED]: 'Attendance Updated',
      [NOTIFICATION_TYPES.ANNOUNCEMENT]: 'School Announcement',
      [NOTIFICATION_TYPES.EVENT_CREATED]: 'New Event'
    };
    
    return titleMap[type] || 'School Notification';
  }

  static async updateBadgeCount() {
    // Implementation for badge count update
    // This would typically use expo-notifications setBadgeCountAsync
    console.log('🔢 [BADGE] Updating badge count');
  }
}

/**
 * SMS notification delivery implementation
 * Placeholder for SMS integration
 */
export class SMSDelivery {
  static async deliver(notification, recipients) {
    try {
      console.log('📱 [SMS] SMS delivery requested for notification:', notification.id);
      
      // This is a placeholder - you would integrate with SMS service like Twilio, AWS SNS, etc.
      const phoneNumbers = recipients
        .filter(r => r.phone)
        .map(r => r.phone);

      if (phoneNumbers.length === 0) {
        return {
          success: false,
          error: 'No phone numbers available for SMS delivery'
        };
      }

      // Simulated SMS sending
      console.log('📤 [SMS] Would send SMS to:', phoneNumbers);
      
      // In real implementation:
      // const smsResult = await sendBulkSMS(phoneNumbers, notification.message);

      return {
        success: true,
        deliveredCount: phoneNumbers.length,
        method: 'sms',
        note: 'SMS delivery simulated - integrate with SMS provider'
      };

    } catch (error) {
      console.error('❌ [SMS] Error in SMS delivery:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * WhatsApp notification delivery implementation
 * Placeholder for WhatsApp Business API integration
 */
export class WhatsAppDelivery {
  static async deliver(notification, recipients) {
    try {
      console.log('💬 [WHATSAPP] WhatsApp delivery requested for notification:', notification.id);
      
      // This is a placeholder - you would integrate with WhatsApp Business API
      const phoneNumbers = recipients
        .filter(r => r.phone)
        .map(r => r.phone);

      if (phoneNumbers.length === 0) {
        return {
          success: false,
          error: 'No phone numbers available for WhatsApp delivery'
        };
      }

      // Simulated WhatsApp sending
      console.log('📤 [WHATSAPP] Would send WhatsApp to:', phoneNumbers);
      
      // In real implementation:
      // const whatsappResult = await sendWhatsAppBulkMessage(phoneNumbers, notification.message);

      return {
        success: true,
        deliveredCount: phoneNumbers.length,
        method: 'whatsapp',
        note: 'WhatsApp delivery simulated - integrate with WhatsApp Business API'
      };

    } catch (error) {
      console.error('❌ [WHATSAPP] Error in WhatsApp delivery:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

/**
 * Main notification delivery coordinator
 */
export class NotificationDeliveryManager {
  static deliveryHandlers = {
    [DELIVERY_MODES.IN_APP]: InAppDelivery,
    [DELIVERY_MODES.SMS]: SMSDelivery,
    [DELIVERY_MODES.WHATSAPP]: WhatsAppDelivery
  };

  static async processNotificationDelivery(notificationId) {
    try {
      // Validate tenant access before processing
      const validation = await TenantNotificationUtils.validateNotificationAccess(notificationId);
      if (!validation.isValid) {
        throw new Error(`Access denied: ${validation.error}`);
      }

      // Get notification and recipients
      const notification = await this.getNotificationById(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      const recipients = await this.getNotificationRecipients(notificationId);
      if (!recipients || recipients.length === 0) {
        throw new Error('No recipients found');
      }

      // Deliver based on delivery mode
      const handler = this.deliveryHandlers[notification.delivery_mode];
      if (!handler) {
        throw new Error(`Unsupported delivery mode: ${notification.delivery_mode}`);
      }

      const result = await handler.deliver(notification, recipients);
      
      // Update delivery status
      await this.updateDeliveryStatus(notificationId, result);

      return result;

    } catch (error) {
      console.error('❌ [DELIVERY_MANAGER] Error processing notification delivery:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getNotificationById(notificationId) {
    try {
      const tenantResult = await TenantNotificationUtils.getCurrentUserTenant();
      if (!tenantResult.success) {
        console.error('❌ [NOTIF_DELIVERY] No tenant context for notification fetch');
        return null;
      }

      const { data, error } = await supabase
        .from(TABLES.NOTIFICATIONS)
        .select('*')
        .eq('id', notificationId)
        .eq('tenant_id', tenantResult.tenantId)
        .single();

      if (error) {
        console.error('❌ [NOTIF_DELIVERY] Error fetching notification:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ [NOTIF_DELIVERY] Exception in getNotificationById:', error);
      return null;
    }
  }

  static async getNotificationRecipients(notificationId) {
    try {
      const tenantResult = await TenantNotificationUtils.getCurrentUserTenant();
      if (!tenantResult.success) {
        console.error('❌ [NOTIF_DELIVERY] No tenant context for recipients fetch');
        return [];
      }

      const { data, error } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select(`
          *,
          users!inner(id, full_name, email, phone)
        `)
        .eq('notification_id', notificationId)
        .eq('tenant_id', tenantResult.tenantId);

      if (error) {
        console.error('❌ [NOTIF_DELIVERY] Error fetching recipients:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ [NOTIF_DELIVERY] Exception in getNotificationRecipients:', error);
      return [];
    }
  }

  static async updateDeliveryStatus(notificationId, deliveryResult) {
    if (deliveryResult.success) {
      // Update main notification
      await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({
          delivery_status: 'Sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      // Update recipients
      await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .update({
          delivery_status: 'Sent',
          sent_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId);
    } else {
      // Mark as failed
      await supabase
        .from(TABLES.NOTIFICATIONS)
        .update({
          delivery_status: 'Failed'
        })
        .eq('id', notificationId);

      await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .update({
          delivery_status: 'Failed'
        })
        .eq('notification_id', notificationId);
    }
  }
}

/**
 * UI utility functions for React Native components
 */
export const NotificationUIUtils = {
  /**
   * Get notifications for current user (tenant-aware using filtering utility)
   * @param {string} userId - Current user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of notifications
   */
  async getUserNotifications(userId, options = {}) {
    try {
      console.log(`📱 [NOTIF_UI] Getting tenant-filtered notifications for user: ${userId}`);
      
      // Use the tenant filtering utility to get ONLY current tenant's notifications
      const result = await getUserTenantFilteredNotifications(userId, {
        unreadOnly: options.unreadOnly,
        limit: options.limit || 50
      });
      
      if (result.error) {
        console.error('❌ [NOTIF_UI] Error fetching user notifications:', result.error);
        return [];
      }
      
      console.log(`✅ [NOTIF_UI] Found ${result.data.length} notifications for user in tenant ${result.tenantName}`);
      return result.data;
      
    } catch (error) {
      console.error('❌ [NOTIF_UI] Exception in getUserNotifications:', error);
      return [];
    }
  },

  /**
   * Mark notification as read (tenant-aware using filtering utility)
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async markAsRead(notificationId, userId) {
    try {
      console.log(`📋 [NOTIF_UI] Marking notification as read with tenant validation`);
      
      // Use the tenant filtering utility to mark as read with validation
      const result = await markTenantNotificationAsRead(notificationId, userId);
      
      if (!result.success) {
        console.error('❌ [NOTIF_UI] Failed to mark as read:', result.error);
        return false;
      }
      
      console.log(`✅ [NOTIF_UI] Successfully marked notification ${notificationId} as read`);
      return true;
      
    } catch (error) {
      console.error('❌ [NOTIF_UI] Exception in markAsRead:', error);
      return false;
    }
  },

  /**
   * Get unread notification count (tenant-aware using filtering utility)
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    try {
      console.log(`🔢 [UNREAD_COUNT] Getting tenant-filtered unread count for user: ${userId}`);
      
      // Use the tenant filtering utility to get unread count with validation
      const count = await getTenantFilteredUnreadCount(userId);
      
      console.log(`✅ [UNREAD_COUNT] Found ${count} unread notifications with tenant filtering`);
      return count;
      
    } catch (error) {
      console.error('❌ [UNREAD_COUNT] Exception:', error);
      return 0;
    }
  },

  /**
   * Show notification alert in React Native
   * @param {Object} notification - Notification object
   * @param {Function} onPress - Callback when notification is pressed
   */
  showNotificationAlert(notification, onPress) {
    Alert.alert(
      InAppDelivery.getNotificationTitle(notification.type),
      formatNotificationMessage(notification),
      [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'View', onPress: () => onPress(notification) }
      ]
    );
  },

  /**
   * Process pending notifications on app startup
   * @param {string} userId - Current user ID
   */
  async processPendingNotifications(userId) {
    try {
      // Get any notifications that haven't been delivered locally
      const notifications = await this.getUserNotifications(userId, { 
        unreadOnly: true,
        limit: 10 
      });

      // Process each for local delivery
      for (const notification of notifications) {
        await InAppDelivery.storeLocalNotification(notification);
      }

      console.log(`✅ [PENDING] Processed ${notifications.length} pending notifications`);

    } catch (error) {
      console.error('❌ [PENDING] Error processing pending notifications:', error);
    }
  }
};

/**
 * Notification permission manager
 */
export const NotificationPermissions = {
  /**
   * Request notification permissions
   * @returns {Promise<boolean>} Permission granted status
   */
  async requestPermissions() {
    try {
      // For web
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          return permission === 'granted';
        }
        return Notification.permission === 'granted';
      }

      // For React Native - would use expo-notifications
      // const { status } = await Notifications.requestPermissionsAsync();
      // return status === 'granted';

      return true; // Default to true for now

    } catch (error) {
      console.error('❌ [PERMISSIONS] Error requesting permissions:', error);
      return false;
    }
  },

  /**
   * Check current permission status
   * @returns {boolean} Permission status
   */
  hasPermissions() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return true; // Default to true for React Native
  }
};

// Export everything as default object
export default {
  DELIVERY_MODES,
  NOTIFICATION_TYPES,
  getNotificationIcon,
  getNotificationColor,
  formatNotificationMessage,
  formatNotificationTime,
  InAppDelivery,
  SMSDelivery,
  WhatsAppDelivery,
  NotificationDeliveryManager,
  NotificationUIUtils,
  NotificationPermissions
};
