import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

/**
 * Get Expo Push Token for the current device
 * @returns {Promise<string|null>} The push token or null if failed
 */
export async function getExpoPushToken() {
  try {
    // Setup Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    // Check if running on physical device
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.warn('Permission not granted for push notifications');
      return null;
    }

    // Get project ID
    const projectId = 
      Constants?.expoConfig?.extra?.eas?.projectId ?? 
      Constants?.easConfig?.projectId;
      
    if (!projectId) {
      console.error('Project ID not found in app configuration');
      return null;
    }

    // Get push token using project ID
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
    
    console.log('✅ Expo push token retrieved:', pushTokenString);
    return pushTokenString;

  } catch (error) {
    console.error('❌ Failed to get push token:', error);
    return null;
  }
}

/**
 * Send a push notification to a specific token
 * @param {string} expoPushToken - The Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 * @returns {Promise<boolean>} Success status
 */
export async function sendPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken) {
    console.error('No push token provided');
    return false;
  }

  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: {
      ...data,
      timestamp: Date.now(),
      source: 'vidyasetu_app'
    },
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Push notification sent successfully:', result);
    return true;

  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
    return false;
  }
}

/**
 * Store push token in your backend/database
 * @param {string} pushToken - The Expo push token
 * @param {string} userId - User ID
 * @param {string} userType - User type (admin, teacher, parent, student)
 * @returns {Promise<boolean>} Success status
 */
export async function storePushToken(pushToken, userId, userType) {
  try {
    // TODO: Replace with your actual API endpoint or Supabase call
    // Example Supabase implementation:
    /*
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: userId,
        token: pushToken,
        device_type: Platform.OS,
        is_active: true,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    */

    console.log('📝 Push token stored for user:', userId, userType);
    return true;
  } catch (error) {
    console.error('❌ Failed to store push token:', error);
    return false;
  }
}

/**
 * Initialize push notifications for the app
 * Call this in your App.js or main component
 */
export async function initializePushNotifications(userId, userType) {
  try {
    const pushToken = await getExpoPushToken();
    
    if (pushToken) {
      await storePushToken(pushToken, userId, userType);
      console.log('🚀 Push notifications initialized successfully');
      return pushToken;
    } else {
      console.log('⚠️ Push notifications not available on this device');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to initialize push notifications:', error);
    return null;
  }
}