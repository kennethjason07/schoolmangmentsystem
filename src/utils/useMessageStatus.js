import { supabase, TABLES } from './supabase';
import { useAuth } from './AuthContext';

export const useMessageStatus = () => {
  const { user } = useAuth();

  // Mark messages as read when user opens a chat with a specific sender
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
        return { success: false, error };
      }

      console.log('✅ Messages marked as read successfully');
      return { success: true };
    } catch (error) {
      console.log('💥 Error in markMessagesAsRead:', error);
      return { success: false, error };
    }
  };

  // Mark all messages as read for current user (useful for "mark all as read" functionality)
  const markAllMessagesAsRead = async () => {
    try {
      if (!user?.id) return;

      console.log('✅ Marking all messages as read for user:', user.id);

      const { error } = await supabase
        .from(TABLES.MESSAGES)
        .update({ is_read: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.log('❌ Error marking all messages as read:', error);
        return { success: false, error };
      }

      console.log('✅ All messages marked as read successfully');
      return { success: true };
    } catch (error) {
      console.log('💥 Error in markAllMessagesAsRead:', error);
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
        console.log('❌ Error fetching unread count from sender:', error);
        return 0;
      }

      return data ? data.length : 0;
    } catch (error) {
      console.log('💥 Error in getUnreadCountFromSender:', error);
      return 0;
    }
  };

  return {
    markMessagesAsRead,
    markAllMessagesAsRead,
    getUnreadCountFromSender
  };
};
