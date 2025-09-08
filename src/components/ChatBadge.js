import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * ChatBadge - A specialized badge component that ONLY shows unread message counts
 * 
 * This is separate from UniversalNotificationBadge to avoid confusion.
 * Chat tabs should only show message counts, not notification counts.
 * 
 * Features:
 * - Shows ONLY unread message counts (not notifications)
 * - Real-time updates via Supabase subscriptions
 * - Works for all user types (admin, teacher, parent, student)
 * - Intelligent caching for performance
 * 
 * @param {Object} props
 * @param {Object} props.style - Custom style for the badge container
 * @param {Object} props.textStyle - Custom style for the badge text
 * @param {boolean} props.showZero - Whether to show the badge when count is 0
 * @param {Function} props.onCountChange - Callback when count changes
 * @param {string} props.testID - Test ID for testing purposes
 */
const ChatBadge = ({ 
  style, 
  textStyle, 
  showZero = false, 
  onCountChange,
  testID = 'chat-badge'
}) => {
  const { user, userType } = useAuth();
  const [messageCount, setMessageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const subscriptionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Debug logging
  const debugLog = (message, data = '') => {
    console.log(`💬 [ChatBadge - ${userType}] ${message}`, data);
  };

  // Log count changes
  useEffect(() => {
    debugLog('Message count changed', messageCount);
  }, [messageCount]);

  // Fetch ONLY message counts
  const fetchMessageCount = useCallback(async (force = false) => {
    if (!user?.id || !userType) {
      debugLog('No user or userType, resetting count');
      setMessageCount(0);
      return;
    }

    try {
      if (force) {
        universalNotificationService.clearCache(user.id, userType);
      }
      
      setIsLoading(true);
      debugLog('Fetching message count for user', { userId: user.id, userType });
      
      // Get ONLY the message count, not notifications
      const messageCountOnly = await universalNotificationService.getUnreadMessageCount(user.id);
      
      debugLog('Received message count', messageCountOnly);
      setMessageCount(messageCountOnly);
      
      // Call callback if provided
      if (onCountChange) {
        onCountChange(messageCountOnly);
      }
    } catch (error) {
      debugLog('Error fetching message count', error);
      setMessageCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType, onCountChange]);

  // Set up real-time subscription for messages only
  useEffect(() => {
    if (!user?.id || !userType) return;

    debugLog('Setting up message-only subscription');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }

    // Initial fetch
    fetchMessageCount();

    // Set up real-time subscription - but only react to message updates
    const unsubscribe = universalNotificationService.subscribeToUpdates(
      user.id, 
      userType, 
      (reason) => {
        debugLog('Received real-time update', reason);
        
        // Handle different types of updates with different strategies
        if (reason === 'message_read_broadcast') {
          // Message read broadcasts should update immediately with no delay
          debugLog('Message read broadcast - INSTANT refresh');
          fetchMessageCount(true);
        } else if (reason.includes('message') || reason === 'message_update' || 
                   reason === 'new_notification_for_user') {
          debugLog('Received message-related update - quick refresh');
          // Small delay for other message updates to ensure database consistency
          setTimeout(() => fetchMessageCount(true), 50);
        } else {
          debugLog('Ignoring non-message update', reason);
        }
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      debugLog('Cleaning up message subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, userType, fetchMessageCount]);

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      debugLog('App state changed', { from: appStateRef.current, to: nextAppState });
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        debugLog('App became active, refreshing message count');
        fetchMessageCount(true);
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [fetchMessageCount]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      debugLog('Screen focused, refreshing message count');
      fetchMessageCount();
    }, [fetchMessageCount])
  );

  // Don't render if count is 0 and showZero is false
  if (!showZero && messageCount === 0) {
    return null;
  }

  // Don't render if loading and no cached count
  if (isLoading && messageCount === 0) {
    return null;
  }

  return (
    <View 
      style={[styles.badge, style]} 
      testID={testID}
      accessible={true}
      accessibilityLabel={`${messageCount} unread messages`}
      accessibilityRole="text"
    >
      <Text 
        style={[styles.badgeText, textStyle]}
        testID={`${testID}-text`}
      >
        {messageCount > 99 ? '99+' : messageCount.toString()}
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

export default ChatBadge;
