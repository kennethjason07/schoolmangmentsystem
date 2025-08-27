import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../utils/AuthContext';
import { supabase } from '../utils/supabase';
import { badgeNotifier } from '../utils/badgeNotifier';

/**
 * Custom hook to get unread message count for dashboard bell icon
 * Returns the count of unread messages for the current user
 */
export const useUnreadMessageCount = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef(null);
  const pollingRef = useRef(null);

  // Fetch unread count from database
  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!user?.id) {
        setUnreadCount(0);
        return;
      }

      console.log(`🔔 useUnreadMessageCount: Fetching unread count for user:`, user.id);

      const { data: unreadMessages, error } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.log('❌ useUnreadMessageCount: Error fetching unread messages:', error);
        return;
      }

      const count = unreadMessages?.length || 0;
      console.log(`📊 useUnreadMessageCount: Found ${count} unread messages`);
      setUnreadCount(count);

    } catch (error) {
      console.log('💥 useUnreadMessageCount: Error in fetchUnreadCount:', error);
    }
  }, [user?.id]);

  // Set up polling and real-time updates
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    console.log(`🔔 useUnreadMessageCount: Setting up for user:`, user.id);
    
    // Initial fetch
    fetchUnreadCount();

    // Set up polling every 10 seconds
    pollingRef.current = setInterval(() => {
      console.log(`🔄 useUnreadMessageCount: Polling unread count`);
      fetchUnreadCount();
    }, 10000);

    // App state change listener - refresh when app becomes active
    const handleAppStateChange = (nextAppState) => {
      console.log(`🔔 useUnreadMessageCount: App state changed to:`, nextAppState);
      if (nextAppState === 'active') {
        console.log(`🔄 useUnreadMessageCount: App became active, refreshing count`);
        fetchUnreadCount();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Subscribe to badge notification events for instant updates
    const unsubscribeBadgeNotifier = badgeNotifier.subscribe(user.id, (reason) => {
      console.log(`📡 useUnreadMessageCount: Received notification, reason: ${reason}`);
      fetchUnreadCount();
    });

    // Try real-time subscription as a bonus
    let realtimeSubscription = null;
    try {
      const channelName = `unread-messages-${user.id}-${Date.now()}`;
      console.log(`🔔 useUnreadMessageCount: Setting up real-time subscription:`, channelName);
      
      realtimeSubscription = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public', 
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log(`⚡ useUnreadMessageCount: Real-time INSERT event:`, payload);
            setTimeout(() => fetchUnreadCount(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`
          },
          (payload) => {
            console.log(`⚡ useUnreadMessageCount: Real-time UPDATE event:`, payload);
            setTimeout(() => fetchUnreadCount(), 100);
          }
        )
        .subscribe((status) => {
          console.log(`🔔 useUnreadMessageCount: Real-time status:`, status);
        });
    } catch (error) {
      console.log(`❌ useUnreadMessageCount: Real-time setup failed:`, error);
    }

    // Cleanup function
    return () => {
      console.log(`🗿 useUnreadMessageCount: Cleaning up`);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      appStateSubscription?.remove();
      unsubscribeBadgeNotifier();
      if (realtimeSubscription) {
        try {
          realtimeSubscription.unsubscribe();
        } catch (error) {
          console.log('Error unsubscribing from real-time:', error);
        }
      }
    };
  }, [user?.id, fetchUnreadCount]);

  // Refresh count when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        console.log('🔔 useUnreadMessageCount: Screen focused, refreshing count');
        fetchUnreadCount();
      }
    }, [user?.id, fetchUnreadCount])
  );

  // Ensure we always return a valid object with proper fallbacks
  return {
    unreadCount: Number.isInteger(unreadCount) ? unreadCount : 0,
    refreshCount: fetchUnreadCount
  };
};
