/**
 * Chat Badge Debug Utility
 * Helps troubleshoot and fix phantom unread message counts
 */

import { supabase, TABLES } from './supabase';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';

export class ChatBadgeDebugger {
  /**
   * Get detailed information about unread messages for a user
   * @param {string} userId - The user ID to check
   * @returns {Promise<Object>} - Detailed message information
   */
  static async debugUnreadMessages(userId) {
    try {
      if (!userId) return { error: 'No user ID provided' };

      console.log('🔍 [ChatBadgeDebugger] Starting debug for user:', userId);

      // Get tenant context for filtering
      let tenantId = null;
      try {
        const tenantResult = await getCurrentUserTenantByEmail();
        if (tenantResult.success && tenantResult.data?.tenant?.id) {
          tenantId = tenantResult.data.tenant.id;
          console.log('🏢 [ChatBadgeDebugger] Using tenant filter:', tenantId);
        }
      } catch (tenantError) {
        console.warn('⚠️ [ChatBadgeDebugger] Could not get tenant context:', tenantError);
      }

      // Query for unread messages with detailed information
      let query = supabase
        .from(TABLES.MESSAGES)
        .select(`
          id,
          sender_id,
          receiver_id,
          message,
          sent_at,
          is_read,
          message_type,
          student_id,
          tenant_id,
          created_at,
          updated_at
        `)
        .eq('receiver_id', userId)
        .eq('is_read', false);

      // Apply tenant filtering if available
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: unreadMessages, error } = await query.order('sent_at', { ascending: false });

      if (error) {
        console.error('❌ [ChatBadgeDebugger] Error fetching unread messages:', error);
        return { error: error.message };
      }

      const result = {
        userId,
        tenantId,
        unreadCount: unreadMessages?.length || 0,
        messages: unreadMessages || [],
        summary: {
          totalUnread: unreadMessages?.length || 0,
          oldestUnread: unreadMessages?.length > 0 ? 
            unreadMessages[unreadMessages.length - 1].sent_at : null,
          newestUnread: unreadMessages?.length > 0 ? 
            unreadMessages[0].sent_at : null,
          senders: [...new Set(unreadMessages?.map(m => m.sender_id) || [])],
          messageTypes: [...new Set(unreadMessages?.map(m => m.message_type) || [])]
        }
      };

      console.log('📊 [ChatBadgeDebugger] Debug results:', result);
      return result;

    } catch (error) {
      console.error('💥 [ChatBadgeDebugger] Unexpected error:', error);
      return { error: error.message };
    }
  }

  /**
   * Mark all unread messages as read for a user
   * @param {string} userId - The user ID to fix
   * @param {string} [fromSenderId] - Optional: only mark messages from specific sender as read
   * @returns {Promise<Object>} - Result of the operation
   */
  static async forceMarkAllAsRead(userId, fromSenderId = null) {
    try {
      if (!userId) return { error: 'No user ID provided' };

      console.log('🔧 [ChatBadgeDebugger] Force marking messages as read for user:', userId);
      if (fromSenderId) {
        console.log('🔧 [ChatBadgeDebugger] Only from sender:', fromSenderId);
      }

      // Get tenant context for filtering
      let tenantId = null;
      try {
        const tenantResult = await getCurrentUserTenantByEmail();
        if (tenantResult.success && tenantResult.data?.tenant?.id) {
          tenantId = tenantResult.data.tenant.id;
        }
      } catch (tenantError) {
        console.warn('⚠️ [ChatBadgeDebugger] Could not get tenant context:', tenantError);
      }

      // Build update query
      let updateQuery = supabase
        .from(TABLES.MESSAGES)
        .update({ 
          is_read: true, 
          updated_at: new Date().toISOString() 
        })
        .eq('receiver_id', userId)
        .eq('is_read', false);

      // Apply additional filters
      if (tenantId) {
        updateQuery = updateQuery.eq('tenant_id', tenantId);
      }
      if (fromSenderId) {
        updateQuery = updateQuery.eq('sender_id', fromSenderId);
      }

      const { data, error, count } = await updateQuery.select();

      if (error) {
        console.error('❌ [ChatBadgeDebugger] Error marking messages as read:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [ChatBadgeDebugger] Successfully marked messages as read:', {
        updatedCount: data?.length || 0,
        messages: data
      });

      return { 
        success: true, 
        updatedCount: data?.length || 0,
        updatedMessages: data || []
      };

    } catch (error) {
      console.error('💥 [ChatBadgeDebugger] Unexpected error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clean up orphaned messages (messages from deleted users or invalid data)
   * @param {string} userId - The user ID to clean up for
   * @returns {Promise<Object>} - Result of the cleanup
   */
  static async cleanupOrphanedMessages(userId) {
    try {
      if (!userId) return { error: 'No user ID provided' };

      console.log('🧹 [ChatBadgeDebugger] Cleaning up orphaned messages for user:', userId);

      // Get all unread messages for this user
      const debugResult = await this.debugUnreadMessages(userId);
      
      if (debugResult.error) {
        return { error: debugResult.error };
      }

      const orphanedMessages = [];
      
      // Check if senders still exist in the users table
      for (const message of debugResult.messages || []) {
        const { data: senderExists, error: senderError } = await supabase
          .from('users')
          .select('id')
          .eq('id', message.sender_id)
          .single();

        if (senderError || !senderExists) {
          orphanedMessages.push(message);
        }
      }

      console.log('🗑️ [ChatBadgeDebugger] Found orphaned messages:', orphanedMessages.length);

      if (orphanedMessages.length === 0) {
        return { success: true, orphanedCount: 0, cleanedMessages: [] };
      }

      // Delete orphaned messages
      const orphanedIds = orphanedMessages.map(m => m.id);
      const { data, error } = await supabase
        .from(TABLES.MESSAGES)
        .delete()
        .in('id', orphanedIds)
        .select();

      if (error) {
        console.error('❌ [ChatBadgeDebugger] Error cleaning up orphaned messages:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ [ChatBadgeDebugger] Cleaned up orphaned messages:', data?.length || 0);

      return { 
        success: true, 
        orphanedCount: orphanedMessages.length,
        cleanedMessages: data || []
      };

    } catch (error) {
      console.error('💥 [ChatBadgeDebugger] Unexpected error during cleanup:', error);
      return { success: false, error: error.message };
    }
  }
}

// Convenience functions for console usage
export const debugUnreadMessages = (userId) => ChatBadgeDebugger.debugUnreadMessages(userId);
export const forceMarkAllAsRead = (userId, fromSenderId) => ChatBadgeDebugger.forceMarkAllAsRead(userId, fromSenderId);
export const cleanupOrphanedMessages = (userId) => ChatBadgeDebugger.cleanupOrphanedMessages(userId);

// Global functions for browser console debugging
if (typeof window !== 'undefined') {
  window.debugChatBadge = ChatBadgeDebugger;
  window.debugUnreadMessages = debugUnreadMessages;
  window.forceMarkAllAsRead = forceMarkAllAsRead;
  window.cleanupOrphanedMessages = cleanupOrphanedMessages;
}

export default ChatBadgeDebugger;