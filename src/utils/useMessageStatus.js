import { supabase, TABLES } from './supabase';
import { useAuth } from './AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';

export const useMessageStatus = () => {
  const { user } = useAuth();

  // Mark messages as read when user opens a chat with a specific sender
  const markMessagesAsRead = async (senderId) => {
    try {
      if (!user?.id || !senderId) {
        console.log('❌ markMessagesAsRead: Missing user ID or sender ID', { userId: user?.id, senderId });
        return { success: false, error: 'Missing user ID or sender ID' };
      }

      console.log(`📖 markMessagesAsRead: Marking messages as read from sender ${senderId} to user ${user.id}`);
      
      // First, get the unread messages to see what we're about to mark
      const { data: unreadMessages, error: fetchError } = await supabase
        .from(TABLES.MESSAGES)
        .select('id, message, sent_at, is_read')
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
        
      if (fetchError) {
        console.log('❌ markMessagesAsRead: Error fetching unread messages:', fetchError);
      } else {
        console.log(`📖 markMessagesAsRead: Found ${unreadMessages?.length || 0} unread messages to mark as read:`, 
          unreadMessages?.map(m => ({ id: m.id, message: m.message?.substring(0, 30) + '...' })) || []
        );
      }

      const { data: updatedMessages, error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false)
        .select('id, is_read'); // Get the updated records back

      if (error) {
        console.log('❌ markMessagesAsRead: Error updating messages:', error);
        return { success: false, error };
      }

      // Broadcast the message read event to update badges in real-time
      await universalNotificationService.broadcastMessageRead(user.id, senderId);
      console.log('✅ Broadcast message read event for sender:', senderId);

      return { success: true };
    } catch (error) {
      console.log('💥 markMessagesAsRead: Unexpected error:', error);
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
    if (!userId || !senderId) {
      console.log('📊 getUnreadCountFromSender: Missing parameters', { userId, senderId });
      return 0;
    }

    console.log(`📊 getUnreadCountFromSender: Getting count for sender ${senderId} to user ${userId}`);

    const { data, error } = await supabase
      .from(TABLES.MESSAGES)
      .select('id, message, sent_at, is_read')
      .eq('sender_id', senderId)
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .order('sent_at', { ascending: false });

    if (error) {
      console.log('❌ getUnreadCountFromSender: Error fetching unread count:', error);
      return 0;
    }

    const count = data ? data.length : 0;
    console.log(`📊 getUnreadCountFromSender: Found ${count} unread messages from sender ${senderId}`);
    if (count > 0) {
      console.log('📊 getUnreadCountFromSender: Sample messages:', 
        data?.slice(0, 3).map(m => ({ id: m.id, message: m.message?.substring(0, 30) + '...', is_read: m.is_read })) || []
      );
    }

    return count;
  } catch (error) {
    console.log('💥 getUnreadCountFromSender: Unexpected error:', error);
    return 0;
  }
};
