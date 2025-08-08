import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { supabase, TABLES } from '../utils/supabase';

const MessageBadge = ({ userType, style, textStyle }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread messages count
  const fetchUnreadCount = async () => {
    try {
      if (!user?.id) return;

      console.log('🔔 Fetching unread message count for user:', user.id, 'type:', userType);

      // Get messages where current user is receiver and message is not read
      const { data: unreadMessages, error } = await supabase
        .from(TABLES.MESSAGES)
        .select('id, sender_id, receiver_id, sent_at')
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .order('sent_at', { ascending: false });

      if (error && error.code !== '42P01') {
        console.log('❌ Error fetching unread messages:', error);
        setUnreadCount(0);
        return;
      }

      const count = unreadMessages ? unreadMessages.length : 0;
      console.log('🔢 Unread message count:', count);
      setUnreadCount(count);

    } catch (error) {
      console.log('💥 Error in fetchUnreadCount:', error);
      setUnreadCount(0);
    }
  };

  // Function to mark messages as read (can be called from chat screens)
  const markMessagesAsRead = async (senderId) => {
    try {
      if (!user?.id || !senderId) return;

      console.log('✅ Marking messages as read from sender:', senderId, 'to receiver:', user.id);

      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.log('❌ Error marking messages as read:', error);
        return;
      }

      // Refresh the unread count after marking as read
      setTimeout(() => {
        fetchUnreadCount();
      }, 500);

      console.log('✅ Messages marked as read successfully');
    } catch (error) {
      console.log('💥 Error in markMessagesAsRead:', error);
    }
  };

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!user?.id) return;

    // Initial fetch
    fetchUnreadCount();

    // Set up real-time subscription
    const subscription = supabase
      .channel(`message-badge-${user.id}-${Date.now()}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: TABLES.MESSAGES,
        filter: `receiver_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 Real-time message update for badge:', payload);
        // Refresh count when new message is received
        setTimeout(() => {
          fetchUnreadCount();
        }, 500);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: TABLES.MESSAGES,
        filter: `sender_id=eq.${user.id}`
      }, (payload) => {
        console.log('🔔 Real-time message sent update for badge:', payload);
        // Refresh count when user sends a message (reduces unread count)
        setTimeout(() => {
          fetchUnreadCount();
        }, 500);
      })
      .subscribe();

    // Refresh every 30 seconds to ensure accuracy
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user?.id]);

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
