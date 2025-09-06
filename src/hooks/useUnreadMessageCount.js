import { useState, useEffect, useCallback } from 'react';
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

  // Fetch unread count from database
  const fetchUnreadCount = useCallback(async () => {
    try {
      if (!user?.id) {
        setUnreadCount(0);
        return;
      }

      // Fetch ONLY unread messages from the messages table
      const { data: unreadMessages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (messagesError) {
        console.log('Error fetching unread messages:', messagesError);
        setUnreadCount(0);
        return;
      }

      const messageCount = unreadMessages?.length || 0;
      setUnreadCount(messageCount);

    } catch (error) {
      console.log('💥 useUnreadMessageCount: Error in fetchUnreadCount:', error);
      setUnreadCount(0);
    }
  }, [user?.id]);

  // Set up real-time subscription
  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    
    // Initial fetch
    fetchUnreadCount();

    // Subscribe to badge notification events
    const handleBadgeRefresh = () => {
      fetchUnreadCount();
    };
    
    // The subscribe method returns an unsubscribe function
    const unsubscribeBadgeNotifier = badgeNotifier.subscribe(user.id, handleBadgeRefresh);

    // Real-time subscription for message changes
    const messageSubscription = supabase
      .channel(`message-updates-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        // Refresh count when messages change
        fetchUnreadCount();
      })
      .subscribe();

    // Cleanup function
    return () => {
      // Call the unsubscribe function returned by subscribe
      unsubscribeBadgeNotifier();
      if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
      }
    };
  }, [user?.id, fetchUnreadCount]);

  // Ensure we always return a valid object with proper fallbacks
  return {
    unreadCount: Number.isInteger(unreadCount) ? unreadCount : 0,
    refreshCount: fetchUnreadCount
  };
};
