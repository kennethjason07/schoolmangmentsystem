/**
 * Enhanced real-time message handler for instant messaging
 * Provides optimistic UI updates combined with real-time synchronization
 */

export class RealtimeMessageHandler {
  constructor(supabase, messagesTable = 'messages') {
    this.supabase = supabase;
    this.messagesTable = messagesTable;
    this.subscription = null;
    this.messageQueue = new Map(); // Track pending messages
    this.syncRetries = new Map(); // Track retry attempts
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Start real-time subscription for a specific chat
   * @param {string} userId - Current user ID
   * @param {string} contactUserId - Contact's user ID
   * @param {function} onMessageUpdate - Callback for message updates
   * @param {function} onTypingUpdate - Callback for typing updates (optional)
   */
  startSubscription(userId, contactUserId, onMessageUpdate, onTypingUpdate = null) {
    this.stopSubscription(); // Clean up existing subscription
    
    const channelName = `chat-${Math.min(userId, contactUserId)}-${Math.max(userId, contactUserId)}`;
    
    console.log('🚀 Starting real-time subscription for channel:', channelName);
    
    this.subscription = this.supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: this.messagesTable,
        filter: `sender_id=eq.${userId},receiver_id=eq.${contactUserId}`
      }, (payload) => {
        console.log('📨 Real-time INSERT (sent):', payload);
        this.handleRealtimeMessage(payload, onMessageUpdate, 'sent');
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: this.messagesTable,
        filter: `sender_id=eq.${contactUserId},receiver_id=eq.${userId}`
      }, (payload) => {
        console.log('📨 Real-time INSERT (received):', payload);
        this.handleRealtimeMessage(payload, onMessageUpdate, 'received');
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: this.messagesTable,
        filter: `sender_id=eq.${userId},receiver_id=eq.${contactUserId}`
      }, (payload) => {
        console.log('📝 Real-time UPDATE (sent):', payload);
        this.handleRealtimeMessage(payload, onMessageUpdate, 'updated');
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: this.messagesTable,
        filter: `sender_id=eq.${contactUserId},receiver_id=eq.${userId}`
      }, (payload) => {
        console.log('📝 Real-time UPDATE (received):', payload);
        this.handleRealtimeMessage(payload, onMessageUpdate, 'updated');
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: this.messagesTable
      }, (payload) => {
        console.log('🗑️ Real-time DELETE:', payload);
        this.handleRealtimeMessage(payload, onMessageUpdate, 'deleted');
      })
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
      });
    
    return this.subscription;
  }

  /**
   * Handle real-time message updates
   * @param {object} payload - Supabase real-time payload
   * @param {function} onMessageUpdate - Callback for message updates
   * @param {string} eventType - Type of event (sent, received, updated, deleted)
   */
  handleRealtimeMessage(payload, onMessageUpdate, eventType) {
    try {
      const messageData = payload.new || payload.old;
      
      if (!messageData) {
        console.warn('⚠️ No message data in payload:', payload);
        return;
      }

      // Remove from pending queue if this was an optimistic update
      if (this.messageQueue.has(messageData.id)) {
        console.log('✅ Confirming optimistic message:', messageData.id);
        this.messageQueue.delete(messageData.id);
        this.syncRetries.delete(messageData.id);
      }

      // Format the message
      const formattedMessage = {
        ...messageData,
        message_type: messageData.message_type || 'text',
        timestamp: new Date(messageData.sent_at || messageData.created_at).toISOString()
      };

      // Call the update callback immediately
      onMessageUpdate(formattedMessage, eventType);

    } catch (error) {
      console.error('❌ Error handling real-time message:', error);
    }
  }

  /**
   * Send a message with optimistic UI update
   * @param {object} messageData - Message data to send
   * @param {function} onOptimisticUpdate - Callback for optimistic UI update
   * @param {function} onConfirmed - Callback when message is confirmed
   * @param {function} onError - Callback for error handling
   */
  async sendMessageOptimistic(messageData, onOptimisticUpdate, onConfirmed, onError) {
    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const optimisticMessage = {
      ...messageData,
      id: tempId,
      sent_at: new Date().toISOString(),
      message_type: messageData.message_type || 'text',
      pending: true // Mark as pending
    };

    try {
      // 1. Immediate optimistic update
      console.log('⚡ Adding optimistic message:', optimisticMessage);
      onOptimisticUpdate(optimisticMessage);
      
      // Track in queue
      this.messageQueue.set(tempId, optimisticMessage);

      // 2. Send to database
      const { data: insertedMsg, error: sendError } = await this.supabase
        .from(this.messagesTable)
        .insert(messageData)
        .select()
        .single();

      if (sendError) {
        console.error('❌ Database insert failed:', sendError);
        throw sendError;
      }

      // 3. Replace optimistic message with real one
      const confirmedMessage = {
        ...insertedMsg,
        message_type: insertedMsg.message_type || 'text',
        pending: false
      };

      console.log('✅ Message confirmed:', confirmedMessage);
      
      // Remove from pending queue
      this.messageQueue.delete(tempId);
      this.syncRetries.delete(tempId);
      
      // Update UI with confirmed message
      onConfirmed(tempId, confirmedMessage);

    } catch (error) {
      console.error('❌ Send message error:', error);
      
      // Mark message as failed
      const failedMessage = {
        ...optimisticMessage,
        failed: true,
        error: error.message
      };
      
      // Try to retry
      this.retryFailedMessage(tempId, messageData, onConfirmed, onError);
      
      onError(tempId, failedMessage, error);
    }
  }

  /**
   * Retry sending a failed message
   * @param {string} tempId - Temporary message ID
   * @param {object} messageData - Original message data
   * @param {function} onConfirmed - Success callback
   * @param {function} onError - Error callback
   */
  async retryFailedMessage(tempId, messageData, onConfirmed, onError) {
    const retryCount = this.syncRetries.get(tempId) || 0;
    
    if (retryCount >= this.maxRetries) {
      console.error('❌ Max retries reached for message:', tempId);
      return;
    }

    this.syncRetries.set(tempId, retryCount + 1);
    
    setTimeout(async () => {
      try {
        console.log(`🔄 Retry attempt ${retryCount + 1} for message:`, tempId);
        
        const { data: insertedMsg, error: sendError } = await this.supabase
          .from(this.messagesTable)
          .insert(messageData)
          .select()
          .single();

        if (sendError) throw sendError;

        const confirmedMessage = {
          ...insertedMsg,
          message_type: insertedMsg.message_type || 'text',
          pending: false
        };

        // Remove from queues
        this.messageQueue.delete(tempId);
        this.syncRetries.delete(tempId);
        
        onConfirmed(tempId, confirmedMessage);
        
      } catch (error) {
        console.error(`❌ Retry ${retryCount + 1} failed:`, error);
        if (retryCount + 1 < this.maxRetries) {
          this.retryFailedMessage(tempId, messageData, onConfirmed, onError);
        }
      }
    }, this.retryDelay * (retryCount + 1)); // Exponential backoff
  }

  /**
   * Stop the current subscription
   */
  stopSubscription() {
    if (this.subscription) {
      console.log('🛑 Stopping real-time subscription');
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    // Clear pending queues
    this.messageQueue.clear();
    this.syncRetries.clear();
  }

  /**
   * Get pending message count
   */
  getPendingCount() {
    return this.messageQueue.size;
  }

  /**
   * Check if a message is pending
   * @param {string} messageId - Message ID to check
   */
  isPending(messageId) {
    return this.messageQueue.has(messageId);
  }

  /**
   * Sync any pending messages (useful for reconnection)
   * @param {function} onConfirmed - Success callback
   * @param {function} onError - Error callback
   */
  async syncPendingMessages(onConfirmed, onError) {
    console.log('🔄 Syncing pending messages:', this.messageQueue.size);
    
    for (const [tempId, message] of this.messageQueue.entries()) {
      try {
        const messageData = {
          sender_id: message.sender_id,
          receiver_id: message.receiver_id,
          student_id: message.student_id,
          message: message.message,
          message_type: message.message_type || 'text'
        };

        const { data: insertedMsg, error: sendError } = await this.supabase
          .from(this.messagesTable)
          .insert(messageData)
          .select()
          .single();

        if (sendError) throw sendError;

        const confirmedMessage = {
          ...insertedMsg,
          message_type: insertedMsg.message_type || 'text',
          pending: false
        };

        this.messageQueue.delete(tempId);
        this.syncRetries.delete(tempId);
        
        onConfirmed(tempId, confirmedMessage);
        
      } catch (error) {
        console.error('❌ Sync failed for message:', tempId, error);
        onError(tempId, message, error);
      }
    }
  }
}

/**
 * Format message timestamp for display
 * @param {string} timestamp - ISO timestamp string
 * @returns {string} Formatted time string
 */
export const formatMessageTime = (timestamp) => {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch (error) {
    return 'Unknown';
  }
};

/**
 * Create a singleton instance for global use
 */
let globalHandler = null;

export const getGlobalMessageHandler = (supabase, messagesTable = 'messages') => {
  if (!globalHandler) {
    globalHandler = new RealtimeMessageHandler(supabase, messagesTable);
  }
  return globalHandler;
};

export default RealtimeMessageHandler;
