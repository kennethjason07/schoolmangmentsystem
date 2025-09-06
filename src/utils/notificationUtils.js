import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Notification permission and registration utilities
 */

// Storage keys
const STORAGE_KEYS = {
  PUSH_TOKEN: 'push_token',
  PERMISSION_REQUESTED: 'push_permission_requested',
  NOTIFICATIONS_ENABLED: 'notifications_enabled',
};

/**
 * Check if device supports push notifications
 */
export const isDeviceSupported = () => {
  return Device.isDevice;
};

/**
 * Get current notification permission status
 */
export const getPermissionStatus = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (error) {
    console.error('Error getting permission status:', error);
    return 'undetermined';
  }
};

/**
 * Request notification permissions with user-friendly prompts
 */
export const requestNotificationPermissions = async (userType = 'student') => {
  try {
    // Check if we already have permissions
    const currentStatus = await getPermissionStatus();
    if (currentStatus === 'granted') {
      return { status: 'granted', token: await getStoredPushToken() };
    }

    // Check if user previously denied permissions
    const hasRequestedBefore = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_REQUESTED);
    
    if (currentStatus === 'denied' && hasRequestedBefore) {
      // Show settings alert for denied permissions
      return await showPermissionSettingsAlert(userType);
    }

    // Show explanation dialog before requesting permissions
    const shouldProceed = await showPermissionExplanation(userType);
    if (!shouldProceed) {
      return { status: 'denied', token: null };
    }

    // Mark that we've requested permissions
    await AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_REQUESTED, 'true');

    // Request permissions
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
        allowCriticalAlerts: userType === 'admin', // Only admins get critical alerts
      },
      android: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    if (status === 'granted') {
      // Get push token and store it
      const token = await registerPushToken();
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
      return { status: 'granted', token };
    } else {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
      return { status, token: null };
    }

  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return { status: 'error', token: null };
  }
};

/**
 * Show permission explanation dialog
 */
const showPermissionExplanation = (userType) => {
  return new Promise((resolve) => {
    const messages = {
      student: {
        title: 'Stay Updated with School Notifications',
        message: 'Get instant notifications for:\n\n• Homework assignments\n• Exam schedules\n• School announcements\n• Chat messages from teachers\n\nYou can customize these later in settings.',
      },
      parent: {
        title: 'Stay Connected with Your Child\'s School',
        message: 'Receive important notifications about:\n\n• Your child\'s attendance\n• Fee reminders\n• School events\n• Messages from teachers\n• Emergency alerts',
      },
      teacher: {
        title: 'School Communication Notifications',
        message: 'Get notified for:\n\n• Messages from parents\n• School announcements\n• Attendance reminders\n• Important school updates',
      },
      admin: {
        title: 'School Management Notifications',
        message: 'Receive critical notifications for:\n\n• System alerts\n• Emergency situations\n• Important messages\n• Administrative updates\n• High-priority communications',
      }
    };

    const { title, message } = messages[userType] || messages.student;

    Alert.alert(
      title,
      message,
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Enable Notifications',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false }
    );
  });
};

/**
 * Show settings alert for denied permissions
 */
const showPermissionSettingsAlert = (userType) => {
  return new Promise((resolve) => {
    const userTypeText = userType === 'admin' ? 'administrative' : userType;
    
    Alert.alert(
      'Notifications Disabled',
      `To receive important ${userTypeText} notifications, please enable notifications in your device settings.\n\nGo to Settings > Notifications > VidyaSetu and turn on notifications.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve({ status: 'denied', token: null }),
        },
        {
          text: 'Open Settings',
          onPress: async () => {
            // On iOS/Android, this would typically open settings
            // For now, we'll just return denied status
            resolve({ status: 'denied', token: null });
          },
        },
      ]
    );
  });
};

/**
 * Register device for push notifications and get token
 */
export const registerPushToken = async () => {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Get Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || '4292160a-508d-4188-83e1-58927769c327';
    
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;
    
    // Store token locally
    await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, token);
    
    console.log('📱 Push token registered:', token);
    return token;

  } catch (error) {
    console.error('Error registering push token:', error);
    return null;
  }
};

/**
 * Store push token in database with user information
 */
export const storePushTokenInDatabase = async (token, userId, userType) => {
  try {
    if (!token || !userId) {
      console.warn('Missing token or userId for database storage');
      return false;
    }

    // Get device information
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      deviceName: await Device.deviceName || 'Unknown Device',
      modelName: Device.modelName || 'Unknown Model',
      osVersion: Device.osVersion || 'Unknown Version',
      brand: Device.brand || 'Unknown Brand',
    };

    // Check if token already exists
    const { data: existingToken, error: fetchError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('token', token)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking existing token:', fetchError);
    }

    if (existingToken) {
      // Update existing token
      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({
          updated_at: new Date().toISOString(),
          is_active: true,
          device_info: deviceInfo,
          user_type: userType,
        })
        .eq('id', existingToken.id);

      if (updateError) {
        console.error('Error updating push token:', updateError);
        return false;
      }

      console.log('✅ Push token updated in database');
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from('push_tokens')
        .insert({
          user_id: userId,
          token: token,
          platform: Platform.OS,
          is_active: true,
          device_info: deviceInfo,
          user_type: userType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error inserting push token:', insertError);
        
        // If table doesn't exist, show helpful message
        if (insertError.code === '42P01') {
          console.log(`
🗄️ Database table 'push_tokens' doesn't exist. Please create it with this SQL:

CREATE TABLE push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'teacher', 'parent', 'student')),
  is_active BOOLEAN DEFAULT true,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Indexes for performance
CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON push_tokens(is_active);
CREATE INDEX idx_push_tokens_user_type ON push_tokens(user_type);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view own tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all tokens" ON push_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );
          `);
        }
        
        return false;
      }

      console.log('✅ Push token stored in database');
    }

    return true;

  } catch (error) {
    console.error('Error storing push token in database:', error);
    return false;
  }
};

/**
 * Get stored push token from local storage
 */
export const getStoredPushToken = async () => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
  } catch (error) {
    console.error('Error getting stored push token:', error);
    return null;
  }
};

/**
 * Initialize push notifications for a user
 */
export const initializePushNotifications = async (userId, userType) => {
  try {
    console.log(`🔔 Initializing push notifications for ${userType}:`, userId);

    // Check device support
    if (!isDeviceSupported()) {
      console.warn('Device does not support push notifications');
      return { success: false, reason: 'Device not supported' };
    }

    // Request permissions and get token
    const { status, token } = await requestNotificationPermissions(userType);
    
    if (status !== 'granted') {
      console.warn('Push notification permissions not granted:', status);
      return { success: false, reason: 'Permissions not granted', status };
    }

    if (!token) {
      console.warn('Failed to get push token');
      return { success: false, reason: 'Token not obtained' };
    }

    // Store token in database
    const stored = await storePushTokenInDatabase(token, userId, userType);
    
    if (!stored) {
      console.warn('Failed to store push token in database');
      return { success: false, reason: 'Database storage failed' };
    }

    console.log('✅ Push notifications initialized successfully');
    return { 
      success: true, 
      token,
      status: 'granted'
    };

  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { success: false, reason: 'Initialization error', error };
  }
};

/**
 * Check if notifications are enabled for user
 */
export const areNotificationsEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
    const status = await getPermissionStatus();
    
    return enabled === 'true' && status === 'granted';
  } catch (error) {
    console.error('Error checking notification status:', error);
    return false;
  }
};

/**
 * Disable notifications for user
 */
export const disableNotifications = async (userId) => {
  try {
    // Update local storage
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'false');
    
    // Deactivate tokens in database
    if (userId) {
      await supabase
        .from('push_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    console.log('✅ Notifications disabled');
    return true;
  } catch (error) {
    console.error('Error disabling notifications:', error);
    return false;
  }
};

/**
 * Re-enable notifications for user
 */
export const enableNotifications = async (userId, userType) => {
  try {
    // Check current permission status
    const status = await getPermissionStatus();
    
    if (status !== 'granted') {
      // Need to request permissions again
      return await initializePushNotifications(userId, userType);
    }

    // Update local storage
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS_ENABLED, 'true');
    
    // Reactivate tokens in database
    if (userId) {
      await supabase
        .from('push_tokens')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    console.log('✅ Notifications re-enabled');
    return { success: true };
  } catch (error) {
    console.error('Error re-enabling notifications:', error);
    return { success: false, error };
  }
};

/**
 * Clear stored notification data (on logout)
 */
export const clearNotificationData = async () => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.PUSH_TOKEN,
      STORAGE_KEYS.NOTIFICATIONS_ENABLED,
    ]);
    console.log('✅ Notification data cleared');
  } catch (error) {
    console.error('Error clearing notification data:', error);
  }
};

/**
 * Get notification statistics for user
 */
export const getNotificationStats = async (userId) => {
  try {
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting notification stats:', error);
      return null;
    }

    const activeTokens = tokens?.filter(token => token.is_active) || [];
    const platforms = [...new Set(activeTokens.map(token => token.platform))];
    
    return {
      totalTokens: tokens?.length || 0,
      activeTokens: activeTokens.length,
      platforms,
      lastUpdated: activeTokens.length > 0 ? 
        Math.max(...activeTokens.map(token => new Date(token.updated_at).getTime())) : null,
    };
  } catch (error) {
    console.error('Error getting notification stats:', error);
    return null;
  }
};
