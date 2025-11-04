import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppState } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';
import { supabase, TABLES } from '../utils/supabase';
import { getCachedTenantId } from '../utils/tenantHelpers';

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

  // Fetch ONLY message counts with enhanced tenant filtering and debugging
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
      debugLog('Fetching message count for user (tenant-aware)', { userId: user.id, userType });

      // Enhanced tenant filtering with better error handling
      let tenantId = null;
      try {
        tenantId = getCachedTenantId();
        debugLog('Using tenant filter', tenantId);
      } catch (e) {
        debugLog('No tenant filter available');
      }

      // Build query with proper tenant filtering
      let query = supabase
        .from(TABLES.MESSAGES)
        .select('id, sender_id, tenant_id, sent_at')
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      
      // Apply tenant filter if available
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
        debugLog('Applied tenant filter');
      } else {
        debugLog('⚠️ No tenant filter - may show cross-tenant messages');
      }

      const { data, error } = await query;
      
      if (error) {
        debugLog('Direct query failed, using fallback service', error);
        // Fallback to service if direct query fails
        const fallback = await universalNotificationService.getUnreadMessageCount(user.id);
        const safeCount = Math.max(0, Number(fallback) || 0);
        debugLog('Fallback service returned count', safeCount);
        setMessageCount(safeCount);
        if (onCountChange) onCountChange(safeCount);
      } else {
        const safeCount = Math.max(0, data?.length || 0);
        
        // Check for potential tenant mismatches (important for data integrity)
        if (data && data.length > 0 && tenantId) {
          const crossTenantMessages = data.filter(msg => 
            msg.tenant_id && msg.tenant_id !== tenantId
          );
          
          if (crossTenantMessages.length > 0) {
            debugLog('❌ Cross-tenant messages detected', {
              count: crossTenantMessages.length,
              totalMessages: data.length
            });
          }
        }
        
        debugLog('Message count updated', safeCount);
        setMessageCount(safeCount);
        if (onCountChange) onCountChange(safeCount);
      }
    } catch (error) {
      debugLog('Error fetching message count', error);
      setMessageCount(0);
      if (onCountChange) onCountChange(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userType, onCountChange, messageCount]);

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

    // 1) Core service subscription (covers broadcasts and other sources)
    const unsubscribeService = universalNotificationService.subscribeToUpdates(
      user.id, 
      userType, 
      (reason) => {
        debugLog('Received real-time update', reason);
        if (reason === 'message_read_broadcast') {
          fetchMessageCount(true);
        } else if (reason.includes('message') || reason === 'message_update') {
          setTimeout(() => fetchMessageCount(true), 50);
        }
      }
    );

    // 2) Direct messages channel for instant badge math without a fetch
    // Enhanced with tenant filtering to prevent cross-tenant updates
    const directChannel = supabase
      .channel(`chat-badge-direct-${user.id}-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLES.MESSAGES, filter: `receiver_id=eq.${user.id}` }, async (payload) => {
        debugLog('Direct INSERT for messages', payload.new?.id);
        
        // Enhanced tenant validation for real-time updates
        let shouldProcess = true;
        if (payload.new?.tenant_id) {
          try {
            const currentTenantId = getCachedTenantId();
            if (currentTenantId && payload.new.tenant_id !== currentTenantId) {
              debugLog('❌ Ignoring INSERT - cross-tenant message');
              shouldProcess = false;
            }
          } catch (e) {
            debugLog('Could not validate tenant for INSERT, processing anyway');
          }
        }
        
        // Only count as unread if the new row is actually unread (is_read === false) and passes tenant check
        if (shouldProcess && payload.new?.is_read === false) {
          setMessageCount((prev) => {
            const next = Math.max(0, (prev || 0) + 1);
            if (onCountChange) onCountChange(next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: TABLES.MESSAGES, filter: `receiver_id=eq.${user.id}` }, async (payload) => {
        // Enhanced tenant validation for updates
        let shouldProcess = true;
        if (payload.new?.tenant_id) {
          try {
            const currentTenantId = getCachedTenantId();
            if (currentTenantId && payload.new.tenant_id !== currentTenantId) {
              debugLog('❌ Ignoring UPDATE - cross-tenant message');
              shouldProcess = false;
            }
          } catch (e) {
            debugLog('Could not validate tenant for UPDATE, processing anyway');
          }
        }
        
        // If a message for me changed from unread->read, decrement
        if (shouldProcess && payload.old?.is_read === false && payload.new?.is_read === true) {
          debugLog('Direct UPDATE is_read flip -> decrement');
          setMessageCount((prev) => {
            const next = Math.max(0, (prev || 0) - 1);
            if (onCountChange) onCountChange(next);
            return next;
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: TABLES.MESSAGES }, async (payload) => {
        // Enhanced tenant validation for deletes
        let shouldProcess = true;
        if (payload.old?.tenant_id) {
          try {
            const currentTenantId = getCachedTenantId();
            if (currentTenantId && payload.old.tenant_id !== currentTenantId) {
              debugLog('❌ Ignoring DELETE - cross-tenant message');
              shouldProcess = false;
            }
          } catch (e) {
            debugLog('Could not validate tenant for DELETE, processing anyway');
          }
        }
        
        if (shouldProcess && payload.old?.receiver_id === user.id && payload.old?.is_read === false) {
          debugLog('Direct DELETE of unread -> decrement');
          setMessageCount((prev) => {
            const next = Math.max(0, (prev || 0) - 1);
            if (onCountChange) onCountChange(next);
            return next;
          });
        }
      })
      .subscribe();

    // Store combined unsubscribe
    subscriptionRef.current = () => {
      try { unsubscribeService?.(); } catch (e) {}
      try { directChannel?.unsubscribe?.(); } catch (e) {}
    };

    // Force-correct the count after channels are live (protect against stale cache)
    setTimeout(() => fetchMessageCount(true), 50);

    return () => {
      debugLog('Cleaning up message subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, userType, fetchMessageCount, onCountChange]);

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
