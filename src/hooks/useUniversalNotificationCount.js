import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

/**
 * Custom hook for universal notification counts
 * 
 * This hook provides notification counts for any user type and handles:
 * - Real-time updates via Supabase subscriptions
 * - Automatic refresh on app focus and screen changes
 * - Intelligent caching for performance
 * - SEPARATES messages and notifications for different contexts
 * 
 * IMPORTANT: Count Usage Guidelines:
 * - Use `notificationCount` for bell icons (system notifications only)
 * - Use `messageCount` for chat/message screens (personal messages only)
 * - Use `totalCount` only when you need both combined
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoRefresh - Whether to auto-refresh on focus (default: true)
 * @param {boolean} options.realTime - Whether to enable real-time subscriptions (default: true)
 * @param {Function} options.onCountChange - Callback when counts change
 * @param {string} options.context - Context for debugging ('bell', 'chat', 'dashboard', etc.)
 * 
 * @returns {Object} Hook result
 * @returns {number} result.totalCount - Total unread count (messages + notifications)
 * @returns {number} result.messageCount - Unread message count (for chat screens)
 * @returns {number} result.notificationCount - Unread notification count (for bell icons)
 * @returns {boolean} result.loading - Whether currently loading
 * @returns {Function} result.refresh - Manual refresh function
 * @returns {string} result.notificationScreen - Appropriate screen name for navigation
 */
export const useUniversalNotificationCount = (options = {}) => {
  const {
    autoRefresh = true,
    realTime = true,
    onCountChange
  } = options;

  const { user, userType } = useAuth();
  const [counts, setCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  const [loading, setLoading] = useState(false);
  const subscriptionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Debug logging (optimized for performance)
  const debugLog = useCallback((message, data = '') => {
    if (__DEV__) {
      console.log(`🚀 [useUniversalNotificationCount - ${userType}] ${message}`, data);
    }
  }, [userType]);

  // Ultra-fast fetch notification counts
  const fetchCounts = useCallback(async (force = false) => {
    if (!user?.id || !userType) {
      debugLog('No user or userType, resetting counts');
      setCounts({ messageCount: 0, notificationCount: 0, totalCount: 0 });
      setLoading(false);
      return;
    }

    try {
      // 🚀 ENHANCED: Add tenant readiness check to prevent race conditions
      // Import getCachedTenantId to check if tenant is ready
      const { getCachedTenantId } = await import('../utils/tenantHelpers');
      const tenantId = getCachedTenantId();
      
      if (!tenantId && !force) {
        debugLog('Tenant context not ready yet, will retry when tenant is initialized');
        // Return zero counts but don't treat as error - tenant might still be loading
        setCounts({ messageCount: 0, notificationCount: 0, totalCount: 0 });
        setLoading(false);
        return;
      }
      
      // Use ultra-fast method that returns cached data instantly if available
      debugLog('Fetching counts (ultra-fast) for user', { userId: user.id, userType, force, tenantReady: !!tenantId });
      
      setLoading(true);
      
      let result;
      if (force) {
        // Force fresh data
        universalNotificationService.clearCache(user.id, userType);
        result = await universalNotificationService.getUnreadCounts(user.id, userType);
      } else {
        // Use fast method that returns cached data immediately if available
        result = await universalNotificationService.getUnreadCountsFast(user.id, userType);
      }
      
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
      setLoading(false);
    }
  }, [user?.id, userType, onCountChange, debugLog]);

  // Manual refresh function
  const refresh = useCallback(() => {
    debugLog('Manual refresh triggered');
    fetchCounts(true);
  }, [fetchCounts, debugLog]);

  // Set up ultra-fast real-time subscription
  useEffect(() => {
    if (!realTime || !user?.id || !userType) return;

    debugLog('Setting up ultra-fast real-time subscription');

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }

    // Set up real-time subscription with intelligent update handling
    const unsubscribe = universalNotificationService.subscribeToUpdates(
      user.id, 
      userType, 
      (reason) => {
        debugLog('Received real-time update', reason);
        
        // Handle different types of updates with different strategies
        switch (reason) {
          case 'direct_count_update':
            // Direct count updates are instant - no delay needed
            debugLog('Direct count update - instant refresh');
            fetchCounts(false); // Use cached data if available
            break;
            
          case 'new_notification_for_user':
            // NEW notification specifically for this user - INSTANT update!
            debugLog('NEW notification for user - INSTANT refresh');
            fetchCounts(true); // Force fresh data immediately
            break;
            
          case 'notification_read_broadcast':
          case 'message_read_broadcast':
            // Broadcast events are instant - minimal delay
            debugLog('Broadcast event - instant refresh');
            setTimeout(() => fetchCounts(true), 10);
            break;
            
          case 'notification_status_update':
            // Notification status changed (read/unread) - quick update
            debugLog('Notification status update - quick refresh');
            setTimeout(() => fetchCounts(true), 20);
            break;
            
          case 'bulk_update':
            // Bulk updates might need a bit more time
            debugLog('Bulk update - quick refresh');
            setTimeout(() => fetchCounts(true), 50);
            break;
            
          case 'new_notification':
            // General new notifications - fresh data needed
            debugLog('New notification - fresh data refresh');
            setTimeout(() => fetchCounts(true), 100);
            break;
            
          case 'message_update':
          case 'notification_update':
          default:
            // Standard database changes - small delay for consistency
            debugLog('Standard update - consistent refresh');
            setTimeout(() => fetchCounts(true), 150);
            break;
        }
      }
    );

    subscriptionRef.current = unsubscribe;

    return () => {
      debugLog('Cleaning up ultra-fast real-time subscription');
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, userType, realTime, fetchCounts, debugLog]);

  // Initial data fetch
  useEffect(() => {
    if (user?.id && userType) {
      debugLog('Initial data fetch');
      fetchCounts();
    }
  }, [user?.id, userType, fetchCounts, debugLog]);

  // Handle app state changes
  useEffect(() => {
    if (!autoRefresh) return;

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
  }, [autoRefresh, fetchCounts, debugLog]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (autoRefresh && user?.id && userType) {
        debugLog('Screen focused, refreshing counts');
        fetchCounts();
      }
    }, [autoRefresh, user?.id, userType, fetchCounts, debugLog])
  );

  // Get the appropriate notification screen for navigation
  const notificationScreen = userType 
    ? universalNotificationService.getNotificationScreen(userType)
    : 'StudentNotifications';

  return {
    totalCount: counts.totalCount,
    messageCount: counts.messageCount,
    notificationCount: counts.notificationCount,
    loading,
    refresh,
    notificationScreen
  };
};

export default useUniversalNotificationCount;
