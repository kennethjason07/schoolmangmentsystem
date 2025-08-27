import { enhancedNotificationService } from '../services/enhancedNotificationService';
import { supabase, TABLES } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

/**
 * Notification Manager Utility for React Native App
 * Provides UI-level notification management functions and delivery mechanisms
 */

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
    const { data, error } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .select('*')
      .eq('id', notificationId)
      .single();

    return error ? null : data;
  }

  static async getNotificationRecipients(notificationId) {
    const { data, error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        *,
        users!inner(id, full_name, email, phone)
      `)
      .eq('notification_id', notificationId);

    return error ? [] : data;
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
   * Get notifications for current user
   * @param {string} userId - Current user ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of notifications
   */
  async getUserNotifications(userId, options = {}) {
    const result = await enhancedNotificationService.getUserNotifications(userId, options);
    return result.success ? result.notifications : [];
  },

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async markAsRead(notificationId, userId) {
    const result = await enhancedNotificationService.markNotificationAsRead(notificationId, userId);
    return result.success;
  },

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      return error ? 0 : count;
    } catch (error) {
      console.error('❌ [UNREAD_COUNT] Error:', error);
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
