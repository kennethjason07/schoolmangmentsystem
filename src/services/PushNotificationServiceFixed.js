import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/supabase';

// Import the original service to fall back to
import OriginalPushNotificationService from './PushNotificationService';

class PushNotificationServiceFixed {
  constructor() {
    this.isExpoGo = false;
    this.hasCheckedEnvironment = false;
    this.originalService = OriginalPushNotificationService;
    
    // Detect if we're in Expo Go
    this.detectEnvironment();
  }

  async detectEnvironment() {
    if (this.hasCheckedEnvironment) return;
    
    try {
      // Check if we're in Expo Go by checking for the specific error
      if (Platform.OS === 'web') {
        this.isExpoGo = false;
      } else {
        // Try to check for expo-notifications functionality
        const { status } = await Notifications.getPermissionsAsync();
        this.isExpoGo = false; // If we get here without error, we're not in problematic Expo Go
      }
    } catch (error) {
      // If we get the specific SDK 53 error, we're in Expo Go
      if (error.message && error.message.includes('expo-notifications') && 
          error.message.includes('SDK 53') && 
          error.message.includes('development build')) {
        console.log('🔔 Detected Expo Go with SDK 53 - push notifications disabled');
        this.isExpoGo = true;
      }
    }
    
    this.hasCheckedEnvironment = true;
  }

  async initialize(userId, userType) {
    await this.detectEnvironment();
    
    // If we're in Expo Go with SDK 53, show a friendly message and return false
    if (this.isExpoGo) {
      console.log('🚫 Push notifications not available in Expo Go with SDK 53');
      console.log('💡 To test push notifications, create a development build');
      return false;
    }

    // If we're on web, use web notifications
    if (Platform.OS === 'web') {
      return this.initializeWebNotifications();
    }

    // If we're not on a device, show mock notifications
    if (!Device.isDevice) {
      console.log('📱 Running in simulator - push notifications disabled');
      return false;
    }

    // Otherwise, use the original service
    try {
      return await this.originalService.initialize(userId, userType);
    } catch (error) {
      // If the original service fails with the SDK 53 error, handle gracefully
      if (error.message && error.message.includes('expo-notifications') && 
          error.message.includes('SDK 53')) {
        console.log('🚫 Push notifications require development build (SDK 53+)');
        return false;
      }
      
      // For other errors, still log but don't crash
      console.error('Push notification initialization failed:', error);
      return false;
    }
  }

  async initializeWebNotifications() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ Web notifications enabled');
          return true;
        }
      } catch (error) {
        console.log('Web notification permission request failed:', error);
      }
    }
    return false;
  }

  // Proxy all other methods to the original service, but with error handling
  async sendChatMessageNotification(params) {
    if (this.isExpoGo || Platform.OS === 'web') {
      return this.sendMockNotification('Chat Message', params.message, params);
    }
    
    try {
      return await this.originalService.sendChatMessageNotification(params);
    } catch (error) {
      console.log('Chat notification failed, using fallback:', error);
      return this.sendMockNotification('Chat Message', params.message, params);
    }
  }

  async sendFormalNotification(params) {
    if (this.isExpoGo || Platform.OS === 'web') {
      return this.sendMockNotification(params.title, params.message, params);
    }
    
    try {
      return await this.originalService.sendFormalNotification(params);
    } catch (error) {
      console.log('Formal notification failed, using fallback:', error);
      return this.sendMockNotification(params.title, params.message, params);
    }
  }

  async sendMockNotification(title, message, data = {}) {
    console.log('📱 Mock Notification:', { title, message, data });
    
    // For development, show an alert
    if (__DEV__ && Platform.OS !== 'web') {
      setTimeout(() => {
        Alert.alert(
          `🔔 ${title}`,
          message,
          [
            { text: 'Dismiss' },
            { text: 'View', onPress: () => console.log('Mock notification tapped') }
          ]
        );
      }, 500);
    }
    
    return true;
  }

  async updateNotificationSettings(userId, settings) {
    try {
      return await this.originalService.updateNotificationSettings(userId, settings);
    } catch (error) {
      console.log('Update notification settings failed:', error);
      return false;
    }
  }

  // Add other methods as needed, all with similar error handling
  async getNotificationSettings(userId) {
    try {
      return await this.originalService.getNotificationSettings(userId);
    } catch (error) {
      console.log('Get notification settings failed:', error);
      return null;
    }
  }

  // Add methods to check environment
  isExpoGoEnvironment() {
    return this.isExpoGo;
  }

  canUsePushNotifications() {
    return !this.isExpoGo && (Device.isDevice || Platform.OS === 'web');
  }

  getStatusMessage() {
    if (this.isExpoGo) {
      return 'Push notifications require a development build (Expo Go + SDK 53 limitation)';
    }
    if (!Device.isDevice && Platform.OS !== 'web') {
      return 'Push notifications not available in simulator';
    }
    if (Platform.OS === 'web') {
      return 'Using web notifications';
    }
    return 'Push notifications available';
  }
}

// Export a singleton instance
export const pushNotificationServiceFixed = new PushNotificationServiceFixed();
export default pushNotificationServiceFixed;
