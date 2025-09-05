import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import pushNotificationService from './PushNotificationService';

/**
 * Development-friendly Push Notification Service
 * Provides fallback methods for testing when Expo Go doesn't support push notifications
 */
class DevelopmentPushService {
  constructor() {
    this.isDevEnvironment = __DEV__;
    this.mockNotifications = [];
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserType = null;
    this.mode = 'unknown'; // 'production', 'web', 'mock', 'simulator'
  }

  /**
   * Initialize push notifications with fallback support
   * @param {string} userId - Current user ID
   * @param {string} userType - Current user type
   */
  async initialize(userId, userType) {
    try {
      this.currentUserId = userId;
      this.currentUserType = userType;

      console.log('🔔 Initializing push notifications...', { Platform: Platform.OS, isDevice: Device.isDevice });

      // For web platform
      if (Platform.OS === 'web') {
        this.mode = 'web';
        const success = await this.initializeWebNotifications();
        console.log('🌐 Web notifications initialized:', success);
        return success;
      }

      // For simulators/emulators
      if (!Device.isDevice) {
        this.mode = 'simulator';
        console.log('📱 Running in simulator - using mock notifications');
        return this.initializeMockNotifications();
      }

      // For physical devices - try real push notifications first
      try {
        const success = await pushNotificationService.initialize(userId, userType);
        if (success) {
          this.mode = 'production';
          console.log('📱 Real push notifications initialized successfully');
          return true;
        }
      } catch (error) {
        console.warn('📱 Real push notifications failed, falling back to mock:', error.message);
      }

      // Fallback to mock notifications
      this.mode = 'mock';
      return this.initializeMockNotifications();

    } catch (error) {
      console.error('❌ Push notification initialization failed:', error);
      this.mode = 'mock';
      return this.initializeMockNotifications();
    }
  }

  /**
   * Initialize web notifications using browser API
   */
  async initializeWebNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('🌐 Web notifications not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Web notification permissions granted');
        this.isInitialized = true;
        this.setupWebNotificationHandlers();
        return true;
      } else {
        console.log('❌ Web notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting web notification permissions:', error);
      return false;
    }
  }

  /**
   * Set up web notification event handlers
   */
  setupWebNotificationHandlers() {
    // Listen for notification clicks
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'notification-click') {
          this.handleNotificationTap(event.data.notificationData);
        }
      });
    }
  }

  /**
   * Initialize mock notifications for development/simulator
   */
  async initializeMockNotifications() {
    console.log('🔔 Mock notification system initialized');
    console.log('💡 Mock notifications will show as alerts and in-app banners');
    this.isInitialized = true;
    return true;
  }

  /**
   * Send chat message notification
   * @param {Object} params - Chat message parameters
   */
  async sendChatMessageNotification(params) {
    const { receiverId, receiverType, senderId, senderName, senderType, message, messageType = 'text' } = params;
    
    console.log('💬 Sending chat notification:', { mode: this.mode, senderName, message: message.substring(0, 50) + '...' });

    const title = `New message from ${senderName}`;
    let body = message;
    
    // Handle different message types
    if (messageType === 'image') {
      body = '📷 Image';
    } else if (messageType === 'file') {
      body = '📎 File attachment';
    } else if (messageType === 'audio') {
      body = '🎵 Audio message';
    } else if (body.length > 100) {
      body = body.substring(0, 100) + '...';
    }

    const notificationData = {
      type: 'chat_message',
      senderId,
      senderName,
      senderType,
      receiverId,
      receiverType,
      messageType,
      chatId: `${senderId}_${receiverId}`,
    };

    return this.sendNotification(title, body, notificationData);
  }

  /**
   * Send formal notification
   * @param {Object} params - Formal notification parameters
   */
  async sendFormalNotification(params) {
    const { recipientIds = [], recipientType, title, message, type = 'general', priority = 'normal', isUrgent = false } = params;
    
    console.log('📢 Sending formal notification:', { mode: this.mode, title, recipientCount: recipientIds.length });

    const results = [];
    
    for (const recipientId of recipientIds) {
      const notificationData = {
        type: 'formal_notification',
        notificationType: type,
        priority,
        isUrgent,
        userType: recipientType,
      };

      const result = await this.sendNotification(title, message, notificationData);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Send notification using the appropriate method based on current mode
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {Object} data - Notification data
   */
  async sendNotification(title, body, data) {
    switch (this.mode) {
      case 'production':
        return this.sendProductionNotification(title, body, data);
      case 'web':
        return this.sendWebNotification(title, body, data);
      case 'mock':
      case 'simulator':
      default:
        return this.sendMockNotification(title, body, data);
    }
  }

  /**
   * Send real push notification using the production service
   */
  async sendProductionNotification(title, body, data) {
    try {
      if (data.type === 'chat_message') {
        return await pushNotificationService.sendChatMessageNotification({
          receiverId: data.receiverId,
          receiverType: data.receiverType,
          senderId: data.senderId,
          senderName: data.senderName,
          senderType: data.senderType,
          message: body,
          messageType: data.messageType
        });
      } else if (data.type === 'formal_notification') {
        return await pushNotificationService.sendFormalNotification({
          recipientIds: [this.currentUserId],
          recipientType: data.userType,
          title,
          message: body,
          type: data.notificationType,
          priority: data.priority,
          isUrgent: data.isUrgent
        });
      }
    } catch (error) {
      console.error('❌ Production notification failed:', error);
      return this.sendMockNotification(title, body, data);
    }
  }

  /**
   * Send web notification using browser API
   */
  async sendWebNotification(title, body, data) {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return this.sendMockNotification(title, body, data);
    }

    if (Notification.permission !== 'granted') {
      console.log('🌐 Web notifications not permitted, showing mock notification');
      return this.sendMockNotification(title, body, data);
    }

    try {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.png',
        tag: data.type || 'default',
        badge: '/favicon.png',
        requireInteraction: false,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        this.handleNotificationTap(data);
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      console.log('🌐 Web notification sent:', title);
      return true;

    } catch (error) {
      console.error('❌ Web notification failed:', error);
      return this.sendMockNotification(title, body, data);
    }
  }

  /**
   * Send mock notification for development/testing
   */
  async sendMockNotification(title, body, data) {
    console.log('📱 Mock Notification Sent:', { title, body, data });
    
    // Show in-app banner first
    setTimeout(() => {
      global.showNotificationBanner?.({ 
        title, 
        body, 
        data,
        duration: 4000
      });
    }, 500);

    // Store for testing purposes
    this.mockNotifications.push({
      id: Date.now(),
      title,
      body,
      data,
      timestamp: new Date().toISOString()
    });

    // Show alert in development for immediate feedback
    if (this.isDevEnvironment) {
      setTimeout(() => {
        Alert.alert(
          `📱 ${title}`,
          body,
          [
            { text: 'Dismiss', style: 'cancel' },
            { 
              text: 'Open', 
              onPress: () => this.handleNotificationTap(data),
              style: 'default'
            }
          ],
          { cancelable: true }
        );
      }, 1000);
    }

    return true;
  }

  /**
   * Handle notification tap/click
   * @param {Object} data - Notification data
   */
  handleNotificationTap(data) {
    console.log('👆 Notification tapped:', data);
    
    if (global.navigationService) {
      global.navigationService.handleNotificationTap(data);
    } else {
      console.warn('⚠️ Navigation service not available');
    }
  }

  /**
   * Get mock notifications for testing
   */
  getMockNotifications() {
    return this.mockNotifications;
  }

  /**
   * Clear mock notifications
   */
  clearMockNotifications() {
    this.mockNotifications = [];
  }

  /**
   * Get current mode for debugging
   */
  getMode() {
    return {
      mode: this.mode,
      isInitialized: this.isInitialized,
      platform: Platform.OS,
      isDevice: Device.isDevice,
      hasWebNotifications: typeof window !== 'undefined' && 'Notification' in window,
      webPermission: typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'N/A'
    };
  }

  /**
   * Update notification settings (proxy to production service)
   */
  async updateNotificationSettings(userId, settings) {
    if (this.mode === 'production') {
      return pushNotificationService.updateNotificationSettings(userId, settings);
    } else {
      // Mock settings update
      console.log('📱 Mock: Notification settings updated', settings);
      return true;
    }
  }

  /**
   * Check notification permission (proxy to production service)
   */
  async checkNotificationPermission(userId, notificationType) {
    if (this.mode === 'production') {
      return pushNotificationService.checkNotificationPermission(userId, notificationType);
    } else {
      // Mock permission check
      return true;
    }
  }

  /**
   * Deactivate tokens on logout
   */
  async deactivateTokens(userId) {
    if (this.mode === 'production') {
      return pushNotificationService.deactivateTokens(userId);
    } else {
      console.log('📱 Mock: Push tokens deactivated for user:', userId);
      return true;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.mode === 'production') {
      pushNotificationService.cleanup();
    }
    
    this.mockNotifications = [];
    this.isInitialized = false;
    console.log('🧹 Development push service cleaned up');
  }

  /**
   * Test notification (for development)
   */
  async sendTestNotification(type = 'chat') {
    if (type === 'chat') {
      return this.sendChatMessageNotification({
        receiverId: 'test-receiver',
        receiverType: 'student',
        senderId: 'test-sender',
        senderName: 'Test Teacher',
        senderType: 'teacher',
        message: 'This is a test chat message from the development service!',
        messageType: 'text'
      });
    } else if (type === 'formal') {
      return this.sendFormalNotification({
        recipientIds: ['test-user'],
        recipientType: 'student',
        title: 'Test School Notification',
        message: 'This is a test formal notification from the school management system.',
        type: 'announcement',
        priority: 'normal',
        isUrgent: false
      });
    } else if (type === 'urgent') {
      return this.sendFormalNotification({
        recipientIds: ['test-user'],
        recipientType: 'student',
        title: '🚨 Urgent Alert',
        message: 'This is a test urgent notification that requires immediate attention.',
        type: 'emergency',
        priority: 'high',
        isUrgent: true
      });
    }
  }
}

// Export singleton instance
export const developmentPushService = new DevelopmentPushService();
export default developmentPushService;
