import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * NotificationBellBadge - A specialized badge component for bell icons
 * 
 * This component ONLY shows system notification counts (NOT chat messages)
 * specifically designed for notification bell icons in headers and navbars.
 * 
 * Key Differences from UniversalNotificationBadge:
 * - Shows ONLY notificationCount (system notifications)
 * - Does NOT include chat messages in the count
 * - Purpose-built for bell icon usage
 * 
 * @param {Object} props
 * @param {Object} props.style - Custom style for the badge container
 * @param {Object} props.textStyle - Custom style for the badge text
 * @param {boolean} props.showZero - Whether to show the badge when count is 0
 * @param {Function} props.onCountChange - Callback when count changes
 * @param {string} props.testID - Test ID for testing purposes
 */
const NotificationBellBadge = ({ 
  style, 
  textStyle, 
  showZero = false, 
  onCountChange,
  testID = 'notification-bell-badge'
}) => {
  const { user, userType } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Debug logging with clear context
  const debugLog = (message, data = '') => {
    console.log(`🔔 [NotificationBellBadge - ${userType}] ${message}`, data);
  };

  // Log count changes with clear explanation
  useEffect(() => {
    debugLog('Bell icon notification count changed', {
      notificationCount,
      note: 'This count EXCLUDES chat messages - system notifications only'
    });
  }, [notificationCount]);

  // Fetch ONLY system notification counts (excludes chat messages)
  const fetchNotificationCount = useCallback(async (force = false) => {
    if (!user?.id || !userType) {
      debugLog('No user or userType, resetting count');
      setNotificationCount(0);
      return;
    }

    try {
      if (force) {
        universalNotificationService.clearCache(user.id, userType);
      }
      
      setIsLoading(true);
      debugLog('Fetching system notification count only', { userId: user.id, userType });
      
      // Get the full counts but use ONLY the notification count (excludes messages)
      const result = await universalNotificationService.getUnreadCounts(user.id, userType);
      
      debugLog('Received counts - using notificationCount only', {
        fullResult: result,
        usingNotificationCount: result.notificationCount,
        excludingMessageCount: result.messageCount
      });
      
      setNotificationCount(result.notificationCount); // ONLY system notifications
      
      // Call callback if provided
      if (onCountChange) {
        onCountChange(result.notificationCount);
      }
    } catch (error) {
      debugLog('Error fetching notification count', error);
      setNotificationCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType, onCountChange]);

  // Set up real-time subscription for notifications only
  useEffect(() => {
    if (!user?.id || !userType) return;

    debugLog('Setting up bell icon notification subscription (notifications only)');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }

    // Initial fetch
    fetchNotificationCount();

    // Set up real-time subscription
    const unsubscribe = universalNotificationService.subscribeToUpdates(
      user.id, 
      userType, 
      (reason) => {
        debugLog('Received real-time update', reason);
        
        // React to all updates since they might affect notification counts
        // (We get the full counts but only use notificationCount)
        setTimeout(() => fetchNotificationCount(true), 100);
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      debugLog('Cleaning up bell icon notification subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, userType, fetchNotificationCount]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      debugLog('App state changed', { from: appStateRef.current, to: nextAppState });
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        debugLog('App became active, refreshing bell notification count');
        fetchNotificationCount(true);
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [fetchNotificationCount]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      debugLog('Screen focused, refreshing bell notification count');
      fetchNotificationCount();
    }, [fetchNotificationCount])
  );

  // Don't render if count is 0 and showZero is false
  if (!showZero && notificationCount === 0) {
    return null;
  }

  // Don't render if loading and no cached count
  if (isLoading && notificationCount === 0) {
    return null;
  }

  return (
    <View 
      style={[styles.badge, style]} 
      testID={testID}
      accessible={true}
      accessibilityLabel={`${notificationCount} unread system notifications`}
      accessibilityRole="text"
    >
      <Text 
        style={[styles.badgeText, textStyle]}
        testID={`${testID}-text`}
      >
        {notificationCount > 99 ? '99+' : notificationCount.toString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default NotificationBellBadge;
