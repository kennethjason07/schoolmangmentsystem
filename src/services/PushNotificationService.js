import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, TABLES } from '../utils/supabase';

/**
 * Comprehensive Push Notification Service
 * Handles push notification registration, sending, and management
 * Similar to WhatsApp's notification system
 */

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { data } = notification.request.content;
    
    // Check if app is in foreground and user is in the chat with sender
    const isInRelevantChat = await checkIfInRelevantChat(data);
    
    return {
      shouldShowAlert: !isInRelevantChat, // Don't show alert if user is already in the chat
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: data.priority || Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
    this.isInitialized = false;
    this.currentUserId = null;
    this.currentUserType = null;
  }

  /**
   * Initialize push notification service
   * @param {string} userId - Current user ID
   * @param {string} userType - Current user type
   */
  async initialize(userId, userType) {
    try {
      this.currentUserId = userId;
      this.currentUserType = userType;

      // Check if device supports push notifications
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return false;
      }

      // Check if running in Expo Go (SDK 53+)
      const isExpoGo = Constants.appOwnership === 'expo';
      if (isExpoGo) {
        console.warn('❌ Push notifications not supported in Expo Go (SDK 53+)');
        console.log('ℹ️ To enable push notifications:');
        console.log('  1. Create a development build: npx expo run:android');
        console.log('  2. Or use EAS Build: eas build --platform android --profile development');
        console.log('  3. Or test on web where notifications work');
        return false;
      }

      // Get existing permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
          android: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Push notification permissions denied');
        return false;
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '4292160a-508d-4188-83e1-58927769c327', // Your actual Expo project ID
      });
      
      this.expoPushToken = tokenData.data;
      console.log('📱 Push token obtained:', this.expoPushToken);

      // Configure notification channels for Android
      if (Platform.OS === 'android') {
        await this.createNotificationChannels();
      }

      // Store token in database
      await this.storeTokenInDatabase(userId, userType);

      // Set up notification listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Push notification initialization failed:', error);
      return false;
    }
  }

  /**
   * Create notification channels for Android
   */
  async createNotificationChannels() {
    // Chat messages channel
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Chat Messages',
      description: 'New messages from teachers, parents, and students',
      importance: Notifications.AndroidImportance.HIGH,
      // Use bundled custom sound (Android): place file in android/app/src/main/res/raw as vidya_setu_message.mp3
      sound: 'vidya_setu_message',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2196F3',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });

    // Formal notifications channel
    await Notifications.setNotificationChannelAsync('formal-notifications', {
      name: 'School Notifications',
      description: 'Important school updates, exam alerts, attendance notifications',
      importance: Notifications.AndroidImportance.HIGH,
      // Use bundled custom sound (Android): place file in android/app/src/main/res/raw as vidya_setu_notification.mp3
      sound: 'vidya_setu_notification',
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#FF5722',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // Urgent notifications channel
    await Notifications.setNotificationChannelAsync('urgent-notifications', {
      name: 'Urgent Notifications',
      description: 'Emergency alerts and urgent school communications',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'urgent_tone.wav', // Custom sound file
      vibrationPattern: [0, 1000, 500, 1000],
      lightColor: '#F44336',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  /**
   * Store push token in database
   * @param {string} userId - User ID
   * @param {string} userType - User type
   */
  async storeTokenInDatabase(userId, userType) {
    try {
      if (!this.expoPushToken) return;

      // Check if token already exists for this user
      const { data: existingTokens } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('token', this.expoPushToken)
        .single();

      if (existingTokens) {
        // Update existing token
        await supabase
          .from('push_tokens')
          .update({
            updated_at: new Date().toISOString(),
            is_active: true,
            user_type: userType,
            device_info: {
              platform: Platform.OS,
              deviceName: Device.deviceName || 'Unknown',
              modelName: Device.modelName || 'Unknown',
              osVersion: Device.osVersion || 'Unknown',
            }
          })
          .eq('id', existingTokens.id);
      } else {
        // Create new token record
        await supabase
          .from('push_tokens')
          .insert({
            user_id: userId,
            user_type: userType,
            token: this.expoPushToken,
            platform: Platform.OS,
            device_info: {
              platform: Platform.OS,
              deviceName: Device.deviceName || 'Unknown',
              modelName: Device.modelName || 'Unknown',
              osVersion: Device.osVersion || 'Unknown',
            },
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
      }

      console.log('✅ Push token stored in database');
    } catch (error) {
      console.error('❌ Error storing push token:', error);
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners() {
    // Listen for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('🔔 Notification received in foreground:', notification);
        this.handleForegroundNotification(notification);
      }
    );

    // Listen for user tapping notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);
        this.handleNotificationResponse(response);
      }
    );
  }

  /**
   * Handle notification received while app is in foreground
   * @param {Object} notification - Notification object
   */
  async handleForegroundNotification(notification) {
    const { data, title, body } = notification.request.content;
    
    // Check if user is currently in the relevant chat/screen
    const isInRelevantContext = await this.checkIfInRelevantContext(data);
    
    if (!isInRelevantContext) {
      // Show in-app banner notification (like WhatsApp)
      this.showInAppBanner({
        title,
        body,
        data,
        notification
      });
    }
  }

  /**
   * Handle notification tap
   * @param {Object} response - Notification response
   */
  handleNotificationResponse(response) {
    const { data } = response.notification.request.content;
    
    // Navigate based on notification type
    this.navigateToRelevantScreen(data);
  }

  /**
   * Check if user is currently in relevant context
   * @param {Object} data - Notification data
   * @returns {boolean}
   */
  async checkIfInRelevantContext(data) {
    try {
      // Get current navigation state from AsyncStorage or navigation service
      const currentRoute = await AsyncStorage.getItem('currentRoute');
      const currentRouteData = await AsyncStorage.getItem('currentRouteData');
      
      if (data.type === 'chat_message') {
        // Check if user is in chat with the sender
        const routeData = JSON.parse(currentRouteData || '{}');
        return currentRoute === 'Chat' && routeData.senderId === data.senderId;
      }
      
      if (data.type === 'formal_notification') {
        // Check if user is on notifications screen
        return currentRoute === 'Notifications' || currentRoute?.includes('Notifications');
      }
      
      return false;
    } catch (error) {
      console.error('Error checking relevant context:', error);
      return false;
    }
  }

  /**
   * Show in-app notification banner
   * @param {Object} params - Banner parameters
   */
  showInAppBanner({ title, body, data }) {
    // This will be implemented with a custom banner component
    // For now, we'll use a simple alert-like notification
    console.log('🔔 Showing in-app banner:', { title, body });
    
    // Emit event for in-app banner component to show
    // This will be handled by a global notification banner component
    global.showNotificationBanner?.({
      title,
      body,
      data,
      duration: 4000, // 4 seconds like WhatsApp
    });
  }

  /**
   * Navigate to relevant screen based on notification data
   * @param {Object} data - Notification data
   */
  navigateToRelevantScreen(data) {
    // This will be implemented with navigation service
    console.log('🔄 Navigating based on notification:', data);
    
    if (data.type === 'chat_message') {
      // Navigate to chat with sender
      global.navigationRef?.navigate('Chat', {
        senderId: data.senderId,
        senderName: data.senderName,
        senderType: data.senderType,
      });
    } else if (data.type === 'formal_notification') {
      // Navigate to appropriate notifications screen
      const notificationScreen = this.getNotificationScreenForUserType(this.currentUserType);
      global.navigationRef?.navigate(notificationScreen);
    }
  }

  /**
   * Get notification screen for user type
   * @param {string} userType - User type
   * @returns {string} - Screen name
   */
  getNotificationScreenForUserType(userType) {
    const screenMap = {
      'admin': 'AdminNotifications',
      'teacher': 'TeacherNotifications',
      'parent': 'ParentNotifications',
      'student': 'StudentNotifications'
    };
    return screenMap[userType?.toLowerCase()] || 'StudentNotifications';
  }

  /**
   * Send push notification to specific user
   * @param {Object} params - Notification parameters
   */
  async sendNotificationToUser({
    userId,
    userType,
    title,
    body,
    data = {},
    sound = 'default',
    priority = 'high',
    channelId = 'formal-notifications'
  }) {
    try {
      // Get user's push tokens
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (!tokens || tokens.length === 0) {
        console.warn(`No push tokens found for user: ${userId}`);
        return false;
      }

      // Prepare notification payload
      const notifications = tokens.map(tokenRecord => ({
        to: tokenRecord.token,
        // iOS sound; Android sound is determined by the channel
        sound: sound || 'default',
        title,
        body,
        data: {
          ...data,
          userId,
          userType,
          timestamp: Date.now(),
        },
        android: {
          channelId,
          priority: priority === 'high' ? 'high' : 'normal',
          sticky: data.type === 'urgent',
        },
        ios: {
          sound,
          badge: 1, // Will be updated with actual count
        },
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

      const result = await response.json();
      console.log('📤 Push notification sent:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      return false;
    }
  }

  /**
   * Send chat message notification
   * @param {Object} params - Chat message parameters
   */
  async sendChatMessageNotification({
    receiverId,
    receiverType,
    senderId,
    senderName,
    senderType,
    message,
    messageType = 'text'
  }) {
    // Check if receiver has chat notifications enabled
    const hasPermission = await this.checkNotificationPermission(receiverId, 'chat_messages');
    if (!hasPermission) return false;

    // Create notification content
    const title = `New message from ${senderName}`;
    let body = message;
    
    // Truncate long messages
    if (body.length > 100) {
      body = body.substring(0, 100) + '...';
    }
    
    // Handle different message types
    if (messageType === 'image') {
      body = '📷 Image';
    } else if (messageType === 'file') {
      body = '📎 File attachment';
    } else if (messageType === 'audio') {
      body = '🎵 Audio message';
    }

    return await this.sendNotificationToUser({
      userId: receiverId,
      userType: receiverType,
      title,
      body,
      data: {
        type: 'chat_message',
        senderId,
        senderName,
        senderType,
        messageType,
        chatId: `${senderId}_${receiverId}`,
      },
      channelId: 'chat-messages',
      priority: 'high',
    });
  }

  /**
   * Send formal notification
   * @param {Object} params - Formal notification parameters
   */
  async sendFormalNotification({
    recipientIds = [],
    recipientType,
    title,
    message,
    type = 'general',
    priority = 'normal',
    isUrgent = false
  }) {
    const results = [];
    
    for (const recipientId of recipientIds) {
      // Check if recipient has formal notifications enabled
      const hasPermission = await this.checkNotificationPermission(recipientId, 'formal_notifications');
      if (!hasPermission) continue;

      const result = await this.sendNotificationToUser({
        userId: recipientId,
        userType: recipientType,
        title,
        body: message,
        data: {
          type: 'formal_notification',
          notificationType: type,
          priority,
          isUrgent,
        },
        channelId: isUrgent ? 'urgent-notifications' : 'formal-notifications',
        priority: isUrgent ? 'max' : priority,
      });
      
      results.push(result);
    }
    
    return results;
  }

  /**
   * Check if user has enabled specific notification type
   * @param {string} userId - User ID
   * @param {string} notificationType - Type of notification
   * @returns {boolean}
   */
  async checkNotificationPermission(userId, notificationType) {
    try {
      const { data: settings } = await supabase
        .from('user_notification_settings')
        .select(`${notificationType}`)
        .eq('user_id', userId)
        .single();

      return settings?.[notificationType] !== false; // Default to true if no settings
    } catch (error) {
      // If no settings found, default to enabled
      return true;
    }
  }

  /**
   * Update notification settings for user
   * @param {string} userId - User ID
   * @param {Object} settings - Notification settings
   */
  async updateNotificationSettings(userId, settings) {
    try {
      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: userId,
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      console.log('✅ Notification settings updated');
      return true;
    } catch (error) {
      console.error('❌ Error updating notification settings:', error);
      return false;
    }
  }

  /**
   * Clean up listeners
   */
  cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  /**
   * Deactivate push tokens for user (on logout)
   * @param {string} userId - User ID
   */
  async deactivateTokens(userId) {
    try {
      await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId);
      
      console.log('✅ Push tokens deactivated');
    } catch (error) {
      console.error('❌ Error deactivating tokens:', error);
    }
  }
}

// Helper function for notification handler
async function checkIfInRelevantChat(data) {
  try {
    if (data.type !== 'chat_message') return false;
    
    const currentRoute = await AsyncStorage.getItem('currentRoute');
    const currentRouteData = await AsyncStorage.getItem('currentRouteData');
    
    if (currentRoute === 'Chat') {
      const routeData = JSON.parse(currentRouteData || '{}');
      return routeData.senderId === data.senderId;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if in relevant chat:', error);
    return false;
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
