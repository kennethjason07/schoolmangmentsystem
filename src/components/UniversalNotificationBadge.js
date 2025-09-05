import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * UniversalNotificationBadge - A single component for notification counts across all user types
 * 
 * Features:
 * - Combines messages and notifications into a unified count
 * - Works for admin, teacher, parent, and student roles
 * - Real-time updates via Supabase subscriptions
 * - Intelligent caching for performance
 * - Auto-refresh on app focus and screen changes
 * 
 * @param {Object} props
 * @param {Object} props.style - Custom style for the badge container
 * @param {Object} props.textStyle - Custom style for the badge text
 * @param {boolean} props.showZero - Whether to show the badge when count is 0
 * @param {Function} props.onCountChange - Callback when count changes
 * @param {string} props.testID - Test ID for testing purposes
 */
const UniversalNotificationBadge = ({ 
  style, 
  textStyle, 
  showZero = false, 
  onCountChange,
  testID = 'universal-notification-badge'
}) => {
  const { user, userType } = useAuth();
  const [counts, setCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Enhanced debug logging for real-time testing
  const debugLog = (message, data = '') => {
    // Always log during debugging - remove "__DEV__" check for now
    console.log(`🔔 [UniversalNotificationBadge - ${userType}] ${message}`, data);
  };

  // Additional debugging for badge updates
  useEffect(() => {
    debugLog('Badge counts changed', counts);
    debugLog('Current user details', { userId: user?.id, userType, email: user?.email });
  }, [counts]);

  // Fetch notification counts
  const fetchCounts = useCallback(async (force = false) => {
    if (!user?.id || !userType) {
      debugLog('No user or userType, resetting counts');
      setCounts({ messageCount: 0, notificationCount: 0, totalCount: 0 });
      return;
    }

    try {
      if (force) {
        universalNotificationService.clearCache(user.id, userType);
      }
      
      setIsLoading(true);
      debugLog('Fetching counts for user', { userId: user.id, userType });
      
      const result = await universalNotificationService.getUnreadCounts(user.id, userType);
      
      debugLog('Received counts', result);
      setCounts(result);
      
      // Call callback if provided
      if (onCountChange) {
        onCountChange(result);
      }
    } catch (error) {
      debugLog('Error fetching counts', error);
      setCounts({ messageCount: 0, notificationCount: 0, totalCount: 0 });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType, onCountChange]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id || !userType) return;

    debugLog('Setting up subscription');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }

    // Initial fetch
    fetchCounts();

    // Set up real-time subscription
    const unsubscribe = universalNotificationService.subscribeToUpdates(
      user.id, 
      userType, 
      (reason) => {
        debugLog('Received real-time update', reason);
        // Small delay to ensure database consistency
        setTimeout(() => fetchCounts(true), 100);
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      debugLog('Cleaning up subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, userType, fetchCounts]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      debugLog('App state changed', { from: appStateRef.current, to: nextAppState });
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        debugLog('App became active, refreshing counts');
        fetchCounts(true);
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [fetchCounts]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      debugLog('Screen focused, refreshing counts');
      fetchCounts();
    }, [fetchCounts])
  );

  // Don't render if count is 0 and showZero is false
  if (!showZero && counts.totalCount === 0) {
    return null;
  }

  // Don't render if loading and no cached count
  if (isLoading && counts.totalCount === 0) {
    return null;
  }

  return (
    <View 
      style={[styles.badge, style]} 
      testID={testID}
      accessible={true}
      accessibilityLabel={`${counts.totalCount} unread notifications`}
      accessibilityRole="text"
    >
      <Text 
        style={[styles.badgeText, textStyle]}
        testID={`${testID}-text`}
      >
        {counts.totalCount > 99 ? '99+' : counts.totalCount.toString()}
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

export default UniversalNotificationBadge;
