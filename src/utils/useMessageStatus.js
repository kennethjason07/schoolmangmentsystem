import { supabase, TABLES } from './supabase';
import { useAuth } from './AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

export const useMessageStatus = () => {
  const { user } = useAuth();

  // Mark messages as read when user opens a chat with a specific sender
  const markMessagesAsRead = async (senderId) => {
    try {
      if (!user?.id || !senderId) return;

      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        return { success: false, error };
      }

      // Broadcast the message read event to update badges in real-time
      await universalNotificationService.broadcastMessageRead(user.id, senderId);
      console.log('✅ Broadcast message read event for sender:', senderId);

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  // Mark all messages as read for current user (useful for "mark all as read" functionality)
  const markAllMessagesAsRead = async () => {
    try {
      if (!user?.id) return;

      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        return { success: false, error };
      }

      // Broadcast the message read event to update badges in real-time
      // For mark all as read, we broadcast with a null sender to indicate all messages
      await universalNotificationService.broadcastMessageRead(user.id, 'ALL');
      console.log('✅ Broadcast mark all messages read event');

      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  };

  // Get unread message count for a specific sender
  const getUnreadCountFromSender = async (senderId) => {
    try {
      if (!user?.id || !senderId) return 0;

      const { data, error } = await supabase
        .from(TABLES.MESSAGES)
        .select('id')
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        return 0;
      }

      return data ? data.length : 0;
    } catch (error) {
      return 0;
    }
  };

  return {
    markMessagesAsRead,
    markAllMessagesAsRead,
    getUnreadCountFromSender
  };
};

// Standalone function for getting unread count from a specific sender
// This can be used outside of React components
export const getUnreadCountFromSender = async (senderId, userId) => {
  try {
    if (!userId || !senderId) return 0;

    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .select('id')
      .eq('sender_id', senderId)
      .eq('receiver_id', userId)
      .eq('is_read', false);

    if (error) {
      console.log('Error fetching unread count:', error);
      return 0;
    }

    return data ? data.length : 0;
  } catch (error) {
    console.log('Error in getUnreadCountFromSender:', error);
    return 0;
  }
};
