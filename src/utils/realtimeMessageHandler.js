/**
 * Enhanced real-time message handler for instant messaging
 * Provides optimistic UI updates combined with real-time synchronization
 * Features robust polling fallback for instant WhatsApp-like messaging
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
    
    // Enhanced connection monitoring and polling
    this.isRealtimeConnected = false;
    this.pollingInterval = null;
    this.connectionCheckInterval = null;
    this.lastMessageTimestamp = null;
    this.currentUserId = null;
    this.currentContactId = null;
    this.messageUpdateCallback = null;
    this.pollingFrequency = 2000; // Poll every 2 seconds when real-time fails
    this.connectionCheckFrequency = 10000; // Check connection every 10 seconds
    this.lastSeenMessageIds = new Set(); // Track seen messages to avoid duplicates
    this.isPollingActive = false;
    
    // Bind methods to preserve context
    this.pollForMessages = this.pollForMessages.bind(this);
    this.checkRealtimeConnection = this.checkRealtimeConnection.bind(this);
  }

  /**
   * Start real-time subscription for a specific chat with enhanced reliability
   * @param {string} userId - Current user ID
   * @param {string} contactUserId - Contact's user ID
   * @param {function} onMessageUpdate - Callback for message updates
   * @param {function} onTypingUpdate - Callback for typing updates (optional)
   */
  startSubscription(userId, contactUserId, onMessageUpdate, onTypingUpdate = null) {
    this.stopSubscription(); // Clean up existing subscription
    
    // Store current chat context
    this.currentUserId = userId;
    this.currentContactId = contactUserId;
    this.messageUpdateCallback = onMessageUpdate;
    
    // Ensure both IDs are valid strings before creating channel name
    const safeUserId = String(userId || 'unknown');
    const safeContactId = String(contactUserId || 'unknown');
    
    // Create a consistent channel name by sorting the IDs alphabetically
    const sortedIds = [safeUserId, safeContactId].sort();
    const channelName = `chat-${sortedIds[0]}-${sortedIds[1]}`;
    
    console.log('🚀 Starting enhanced real-time subscription for channel:', channelName);
    console.log('🔗 User IDs:', { userId: safeUserId, contactUserId: safeContactId });
    
    const isForCurrentChat = (msg) => {
      if (!msg) return false;
      return (
        (msg.sender_id === userId && msg.receiver_id === contactUserId) ||
        (msg.sender_id === contactUserId && msg.receiver_id === userId)
      );
    };

    this.subscription = this.supabase
      .channel(channelName)
      // INSERT: messages sent by me (filter by sender only; narrow in callback)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: this.messagesTable,
        filter: `sender_id=eq.${userId}`
      }, (payload) => {
        const message = payload.new;
        if (!isForCurrentChat(message)) return;
        console.log('📨 Real-time INSERT (sent):', payload);
        this.isRealtimeConnected = true;
        this.handleRealtimeMessage(payload, onMessageUpdate, 'sent');
      })
      // INSERT: messages received by me (filter by receiver only; narrow in callback)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: this.messagesTable,
        filter: `receiver_id=eq.${userId}`
      }, (payload) => {
        const message = payload.new;
        if (!isForCurrentChat(message)) return;
        console.log('📨 Real-time INSERT (received):', payload);
        this.isRealtimeConnected = true;
        this.handleRealtimeMessage(payload, onMessageUpdate, 'received');
      })
      // UPDATE: updates on my sent messages
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: this.messagesTable,
        filter: `sender_id=eq.${userId}`
      }, (payload) => {
        const message = payload.new;
        if (!isForCurrentChat(message)) return;
        console.log('📝 Real-time UPDATE (sent):', payload);
        this.isRealtimeConnected = true;
        this.handleRealtimeMessage(payload, onMessageUpdate, 'updated');
      })
      // UPDATE: updates on messages I receive
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: this.messagesTable,
        filter: `receiver_id=eq.${userId}`
      }, (payload) => {
        const message = payload.new;
        if (!isForCurrentChat(message)) return;
        console.log('📝 Real-time UPDATE (received):', payload);
        this.isRealtimeConnected = true;
        this.handleRealtimeMessage(payload, onMessageUpdate, 'updated');
      })
      // DELETE: receive all deletes, filter in callback
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: this.messagesTable
      }, (payload) => {
        const message = payload.old;
        if (!isForCurrentChat(message)) return;
        console.log('🗑️ Real-time DELETE:', payload);
        this.isRealtimeConnected = true;
        this.handleRealtimeMessage(payload, onMessageUpdate, 'deleted');
      })
      .subscribe((status, err) => {
        console.log('📡 Subscription status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription established!');
          this.isRealtimeConnected = true;
          this.stopPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.log('❌ Real-time connection issue, starting polling fallback');
          this.isRealtimeConnected = false;
          this.startPolling();
        }
      });
    
    // Start connection monitoring
    this.startConnectionMonitoring();
    
    // Start polling as immediate fallback until real-time is confirmed
    this.startPolling();
    
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
   * Start intelligent polling as fallback for real-time
   */
  startPolling() {
    if (this.isPollingActive || !this.currentUserId || !this.currentContactId) {
      return;
    }
    
    console.log('🔄 Starting intelligent message polling');
    this.isPollingActive = true;
    
    this.pollingInterval = setInterval(this.pollForMessages, this.pollingFrequency);
  }
  
  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      console.log('⏹️ Stopping message polling');
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPollingActive = false;
    }
  }
  
  /**
   * Poll for new messages
   */
  async pollForMessages() {
    if (!this.messageUpdateCallback || !this.currentUserId || !this.currentContactId) {
      return;
    }
    
    try {
      // Get the most recent timestamp we've seen
      const sinceTimestamp = this.lastMessageTimestamp || new Date(Date.now() - 60000).toISOString();
      
      // Query for new messages since last check
      const { data: newMessages, error } = await this.supabase
        .from(this.messagesTable)
        .select('*')
        .or(`and(sender_id.eq.${this.currentUserId},receiver_id.eq.${this.currentContactId}),and(sender_id.eq.${this.currentContactId},receiver_id.eq.${this.currentUserId})`)
        .gt('sent_at', sinceTimestamp)
        .order('sent_at', { ascending: true });
      
      if (error) {
        console.error('❌ Polling error:', error);
        return;
      }
      
      if (newMessages && newMessages.length > 0) {
        console.log(`📥 Found ${newMessages.length} new messages via polling`);
        
        for (const message of newMessages) {
          // Avoid duplicates using message ID tracking
          if (this.lastSeenMessageIds.has(message.id)) {
            continue;
          }
          
          this.lastSeenMessageIds.add(message.id);
          
          // Determine event type
          const eventType = message.sender_id === this.currentUserId ? 'sent' : 'received';
          
          // Format and send to callback
          const formattedMessage = {
            ...message,
            message_type: message.message_type || 'text',
            timestamp: new Date(message.sent_at || message.created_at).toISOString()
          };
          
          console.log('📨 Polling found message:', { id: message.id, eventType });
          this.messageUpdateCallback(formattedMessage, eventType);
          
          // Update last timestamp
          if (!this.lastMessageTimestamp || message.sent_at > this.lastMessageTimestamp) {
            this.lastMessageTimestamp = message.sent_at;
          }
        }
        
        // If we found messages via polling and real-time was supposed to be working,
        // it might be having issues - keep polling active
        if (this.isRealtimeConnected && newMessages.length > 0) {
          console.log('⚠️ Real-time might be lagging, continuing polling as backup');
        }
      }
      
    } catch (error) {
      console.error('❌ Error during message polling:', error);
    }
  }
  
  /**
   * Start connection monitoring
   */
  startConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
    
    console.log('👀 Starting connection monitoring');
    this.connectionCheckInterval = setInterval(this.checkRealtimeConnection, this.connectionCheckFrequency);
  }
  
  /**
   * Check if real-time connection is still working
   */
  async checkRealtimeConnection() {
    try {
      // Check if we have a subscription and it's supposed to be connected
      if (!this.subscription) {
        this.isRealtimeConnected = false;
        return;
      }
      
      // Simple ping test - try to query the database
      const { data, error } = await this.supabase
        .from(this.messagesTable)
        .select('id')
        .limit(1);
      
      if (error) {
        console.warn('⚠️ Connection check failed:', error);
        this.isRealtimeConnected = false;
        this.startPolling(); // Fallback to polling
        return;
      }
      
      // If real-time hasn't received any events in a while, consider it stale
      const timeSinceLastRealtime = Date.now() - (this.lastRealtimeActivity || Date.now() - this.connectionCheckFrequency);
      
      if (timeSinceLastRealtime > this.connectionCheckFrequency * 2) {
        console.log('⚠️ Real-time connection seems stale, keeping polling active');
        this.startPolling();
      }
      
    } catch (error) {
      console.error('❌ Connection check error:', error);
      this.isRealtimeConnected = false;
      this.startPolling();
    }
  }

  /**
   * Stop the current subscription and all monitoring
   */
  stopSubscription() {
    console.log('🛑 Stopping subscription and all monitoring');
    
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    
    // Stop polling and monitoring
    this.stopPolling();
    
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Reset state
    this.isRealtimeConnected = false;
    this.currentUserId = null;
    this.currentContactId = null;
    this.messageUpdateCallback = null;
    this.lastMessageTimestamp = null;
    this.lastSeenMessageIds.clear();
    
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
          message_type: message.message_type || 'text',
          tenant_id: message.tenant_id // Include tenant_id for RLS compliance
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
