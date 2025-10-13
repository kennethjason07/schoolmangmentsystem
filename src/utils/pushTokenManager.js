/**
 * 📱 Push Token Management Utility
 * 
 * Handles registration, update, and management of push notification tokens
 * for Expo/React Native apps with Supabase backend.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { getCachedTenantId } from './tenantHelpers';

/**
 * Get push notification permissions and register token
 * @param {Object} user - Current user object
 * @returns {Promise<Object>} Result with success status and token
 */
export const registerForPushNotifications = async (user) => {
  try {
    console.log('📱 [PUSH] Starting push notification registration...');
    
    // Check if device supports push notifications
    if (!Device.isDevice) {
      console.warn('📱 [PUSH] Must use physical device for Push Notifications');
      return {
        success: false,
        error: 'Must use physical device for Push Notifications'
      };
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      console.log('📱 [PUSH] Requesting push notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('📱 [PUSH] Push notification permission denied');
      return {
        success: false,
        error: 'Push notification permission not granted'
      };
    }

    // Get push token
    console.log('📱 [PUSH] Getting Expo push token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID // Make sure this is set
    });

    const token = tokenData.data;
    console.log('📱 [PUSH] Expo push token obtained:', token.substring(0, 20) + '...');

    // Register token with backend
    const result = await registerPushToken(user, token);
    
    if (result.success) {
      console.log('✅ [PUSH] Push notification registration successful');
      return {
        success: true,
        token,
        message: 'Push notifications enabled successfully'
      };
    } else {
      console.error('❌ [PUSH] Failed to register token with backend:', result.error);
      return result;
    }

  } catch (error) {
    console.error('❌ [PUSH] Error in registerForPushNotifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Register push token with Supabase backend
 * @param {Object} user - Current user object
 * @param {string} token - Expo push token
 * @returns {Promise<Object>} Result with success status
 */
export const registerPushToken = async (user, token) => {
  try {
    console.log('📱 [PUSH] Registering token with backend...');
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      throw new Error('Tenant context not available');
    }

    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    // Get device info
    const deviceInfo = {
      deviceType: Platform.OS,
      deviceName: `${Device.brand} ${Device.modelName}` || Platform.OS,
      appVersion: '1.0.0' // You can get this from app.json or expo-constants
    };

    // Upsert push token (insert or update if exists)
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert({
        user_id: user.id,
        token: token,
        device_type: deviceInfo.deviceType,
        device_name: deviceInfo.deviceName,
        app_version: deviceInfo.appVersion,
        is_active: true,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
        last_used: new Date().toISOString()
      }, {
        onConflict: 'user_id,device_name'
      })
      .select();

    if (error) {
      console.error('❌ [PUSH] Database error:', error);
      throw error;
    }

    console.log('✅ [PUSH] Token registered successfully in database');
    return {
      success: true,
      data
    };

  } catch (error) {
    console.error('❌ [PUSH] Error registering push token:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Unregister push token (mark as inactive)
 * @param {Object} user - Current user object
 * @returns {Promise<Object>} Result with success status
 */
export const unregisterPushToken = async (user) => {
  try {
    console.log('📱 [PUSH] Unregistering push tokens...');
    
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    const tenantId = getCachedTenantId();

    // Mark all user tokens as inactive
    const { error } = await supabase
      .from('push_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('❌ [PUSH] Error unregistering tokens:', error);
      throw error;
    }

    console.log('✅ [PUSH] Push tokens unregistered successfully');
    return { success: true };

  } catch (error) {
    console.error('❌ [PUSH] Error in unregisterPushToken:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update token last used timestamp
 * @param {string} token - Push token
 * @returns {Promise<void>}
 */
export const updateTokenLastUsed = async (token) => {
  try {
    const { error } = await supabase
      .from('push_tokens')
      .update({ 
        last_used: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('token', token);

    if (error) {
      console.warn('⚠️ [PUSH] Could not update token last used:', error);
    }
  } catch (error) {
    console.warn('⚠️ [PUSH] Error updating token last used:', error);
  }
};

/**
 * Get user's active push tokens
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of active tokens
 */
export const getUserPushTokens = async (userId) => {
  try {
    const tenantId = getCachedTenantId();
    
    const { data, error } = await supabase
      .from('push_tokens')
      .select('token, device_type, device_name, last_used')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) {
      console.error('❌ [PUSH] Error getting user tokens:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ [PUSH] Error in getUserPushTokens:', error);
    return [];
  }
};

/**
 * Clean up expired or invalid tokens
 * @returns {Promise<void>}
 */
export const cleanupExpiredTokens = async () => {
  try {
    console.log('🧹 [PUSH] Cleaning up expired tokens...');
    
    // Mark tokens as inactive if not used for 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('push_tokens')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .lt('last_used', thirtyDaysAgo.toISOString())
      .eq('is_active', true);

    if (error) {
      console.error('❌ [PUSH] Error cleaning up expired tokens:', error);
    } else {
      console.log('✅ [PUSH] Expired tokens cleaned up');
    }
  } catch (error) {
    console.error('❌ [PUSH] Error in cleanupExpiredTokens:', error);
  }
};

/**
 * Configure notification handling
 */
export const configurePushNotifications = () => {
  // Set notification handler
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  // Handle notification responses (when user taps notification)
  const notificationResponseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('📱 [PUSH] Notification response:', response);
    
    // Handle different notification types
    const data = response.notification.request.content.data;
    if (data?.type) {
      handleNotificationNavigation(data);
    }
  });

  return notificationResponseListener;
};

/**
 * Handle navigation based on notification data
 * @param {Object} data - Notification data
 */
const handleNotificationNavigation = (data) => {
  console.log('📱 [PUSH] Handling notification navigation:', data.type);
  
  // You can implement navigation logic here based on notification type
  switch (data.type) {
    case 'leave_request':
      // Navigate to leave management screen
      break;
    case 'leave_status_update':
      // Navigate to leave status screen
      break;
    case 'message':
      // Navigate to messages
      break;
    default:
      // Default navigation
      break;
  }
};

export default {
  registerForPushNotifications,
  registerPushToken,
  unregisterPushToken,
  updateTokenLastUsed,
  getUserPushTokens,
  cleanupExpiredTokens,
  configurePushNotifications
};