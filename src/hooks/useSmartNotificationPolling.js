import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { universalNotificationService } from '../services/UniversalNotificationService';

/**
 * Smart polling hook that:
 * - Polls faster when app is active and focused
 * - Polls slower when app is in background
 * - Immediately refreshes when screen comes into focus
 * - Provides manual refresh capability
 * - Handles errors gracefully with exponential backoff
 */
export const useSmartNotificationPolling = ({ 
  userId, 
  userType, 
  fastInterval = 15000,  // 15 seconds when active
  slowInterval = 60000,  // 1 minute when background
  onCountsUpdate 
} = {}) => {
  const [counts, setCounts] = useState({
    totalCount: 0,
    notificationCount: 0,
    messageCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const errorCountRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const isActiveRef = useRef(true);
  const onCountsUpdateRef = useRef(onCountsUpdate);

  // Update callback ref
  useEffect(() => {
    onCountsUpdateRef.current = onCountsUpdate;
  }, [onCountsUpdate]);

  // Fetch notification counts (stable function)
  const fetchCounts = async (force = false) => {
    if (!userId || !userType) {
      console.log('🔄 [SmartPolling] Missing userId or userType');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 [SmartPolling] Fetching counts for ${userType} ${userId}`);
      
      const result = await universalNotificationService.getUnreadCounts(userId, userType);
      
      if (result) {
        setCounts(result);
        setLastFetch(new Date());
        errorCountRef.current = 0; // Reset error count on success
        
        // Callback to parent component
        if (onCountsUpdateRef.current) {
          onCountsUpdateRef.current(result);
        }
        
        console.log(`✅ [SmartPolling] Updated counts:`, result);
      }
    } catch (err) {
      console.error('❌ [SmartPolling] Error fetching counts:', err);
      setError(err.message);
      errorCountRef.current += 1;
    } finally {
      setLoading(false);
    }
  };

  // Manual refresh function (stable function)
  const refresh = async () => {
    console.log('🔄 [SmartPolling] Manual refresh triggered');
    // Clear cache for fresh data
    if (userId && userType) {
      universalNotificationService.clearCache(userId, userType);
    }
    await fetchCounts(true);
  };

  // Setup intelligent polling interval (stable function)
  const setupPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Calculate interval based on app state and error count
    let interval = isActiveRef.current ? fastInterval : slowInterval;
    
    // Exponential backoff for errors (max 5 minutes)
    if (errorCountRef.current > 0) {
      interval = Math.min(interval * Math.pow(2, errorCountRef.current), 300000);
    }

    console.log(`⏰ [SmartPolling] Setting up polling every ${interval/1000}s (active: ${isActiveRef.current}, errors: ${errorCountRef.current})`);

    intervalRef.current = setInterval(() => {
      fetchCounts(false);
    }, interval);
  };

  // Handle app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      console.log(`📱 [SmartPolling] App state changed: ${appStateRef.current} → ${nextAppState}`);
      
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🔄 [SmartPolling] App became active, refreshing immediately');
        isActiveRef.current = true;
        fetchCounts(true);
        setupPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('😴 [SmartPolling] App went to background, slowing down polling');
        isActiveRef.current = false;
        setupPolling();
      }
      
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []); // Remove dependencies to prevent infinite loop

  // Handle screen focus
  useFocusEffect(() => {
    console.log('👁️ [SmartPolling] Screen focused, refreshing counts');
    fetchCounts(true);
    return () => {
      console.log('👁️ [SmartPolling] Screen unfocused');
    };
  });

  // Initial setup and cleanup
  useEffect(() => {
    if (userId && userType) {
      console.log(`🚀 [SmartPolling] Starting smart polling for ${userType} ${userId}`);
      fetchCounts(true);
      setupPolling();
    }

    return () => {
      console.log('🛑 [SmartPolling] Cleaning up polling');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, userType]); // Remove function dependencies to prevent infinite loop

  return {
    counts,
    loading,
    error,
    lastFetch,
    refresh,
    // Convenience properties
    totalCount: counts.totalCount,
    notificationCount: counts.notificationCount,
    messageCount: counts.messageCount
  };
};

export default useSmartNotificationPolling;
