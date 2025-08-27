import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES } from '../utils/supabase';
import { getUnreadCountFromSender } from '../utils/useMessageStatus';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { badgeNotifier } from '../utils/badgeNotifier';

const MessageBadge = ({ userType, style, textStyle }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef(null);
  const isInitialized = useRef(false);

  // Fetch unread count from database
  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!user?.id) return;


      const { data: unreadMessages, error } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        return;
      }

      const count = unreadMessages?.length || 0;
      setUnreadCount(count);

    } catch (error) {
    }
  }, [user?.id, userType]);

  // Aggressive polling-based approach with AppState monitoring
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }

    
    // Initial fetch
    fetchUnreadCount();

    // Frequent polling (every 5 seconds)
    const frequentPolling = setInterval(() => {
      fetchUnreadCount();
    }, 5000);

    // App state change listener - refresh when app becomes active
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        fetchUnreadCount();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Subscribe to badge notification events for instant updates
    const unsubscribeBadgeNotifier = badgeNotifier.subscribe(user.id, (reason) => {
      fetchUnreadCount();
    });

    // Also try real-time as a bonus (but don't rely on it)
    let realtimeSubscription = null;
    try {
      const channelName = `message-badge-${userType}-${user.id}-${Date.now()}`;
      
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
            // Immediately refresh count when we get a real-time event
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
            // Immediately refresh count when we get a real-time event
            setTimeout(() => fetchUnreadCount(), 100);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Real-time working!
          } else if (status === 'CHANNEL_ERROR') {
            // Real-time failed, relying on polling
          }
        });
    } catch (error) {
    }

    // Cleanup function
    return () => {
      clearInterval(frequentPolling);
      subscription?.remove();
      unsubscribeBadgeNotifier();
      if (realtimeSubscription) {
        try {
          realtimeSubscription.unsubscribe();
        } catch (error) {
        }
      }
    };
  }, [user?.id, userType, fetchUnreadCount]);

  if (unreadCount === 0) return null;

  return (
    <View style={[{
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
    }, style]}>
      <Text style={[{
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
      }, textStyle]}>
        {unreadCount > 99 ? '99+' : unreadCount.toString()}
      </Text>
    </View>
  );
};

export default MessageBadge;
