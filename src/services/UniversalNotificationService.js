import { supabase, TABLES, getUserTenantId } from '../utils/supabase';

/**
 * Universal Notification Service
 * Handles notification counts for all user types (admin, teacher, parent, student)
 * Combines both messages and formal notifications into a single unified count
 */
export class UniversalNotificationService {
  constructor() {
    this.cache = new Map();
    this.subscriptions = new Map();
    this.broadcastChannels = new Map();
    this.cacheTimeout = 15000; // Reduced to 15 seconds for faster updates
    this.realTimeCallbacks = new Map();
    this.isOnline = true;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    
    // Initialize connection monitoring
    this.initializeConnectionMonitoring();
  }
  
  /**
   * Initialize connection monitoring for network status
   */
  initializeConnectionMonitoring() {
    // Monitor Supabase connection status
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.cleanup();
      } else if (event === 'SIGNED_IN' && !this.isOnline) {
        this.isOnline = true;
        this.reconnectAllSubscriptions();
      }
    });
  }
  
  /**
   * Cleanup all subscriptions and caches
   */
  cleanup() {
    this.subscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    });
    this.subscriptions.clear();
    this.broadcastChannels.clear();
    this.cache.clear();
    this.realTimeCallbacks.clear();
    this.retryAttempts.clear();
  }
  
  /**
   * Reconnect all subscriptions after network recovery
   */
  reconnectAllSubscriptions() {
    const callbacks = Array.from(this.realTimeCallbacks.entries());
    callbacks.forEach(([key, callback]) => {
      const [userId, userType] = key.split('-');
      this.subscribeToUpdates(userId, userType, callback);
    });
  }

  /**
   * Get the user type display name for database queries
   * @param {string} userType - The user type from auth context
   * @returns {string} - Formatted user type for database
   */
  getUserTypeForDB(userType) {
    const typeMap = {
      'admin': 'Admin',
      'teacher': 'Teacher', 
      'parent': 'Parent',
      'student': 'Student'
    };
    return typeMap[userType?.toLowerCase()] || 'Student';
  }

  /**
   * Get navigation screen name based on user type
   * @param {string} userType - The user type from auth context
   * @returns {string} - Screen name for navigation
   */
  getNotificationScreen(userType) {
    const screenMap = {
      'admin': 'AdminNotifications',
      'teacher': 'TeacherNotifications',
      'parent': 'ParentNotifications',
      'student': 'StudentNotifications'
    };
    return screenMap[userType?.toLowerCase()] || 'StudentNotifications';
  }

  /**
   * Fetch unread message count from messages table
   * @param {string} userId - Current user ID
   * @returns {Promise<number>} - Number of unread messages
   */
  async getUnreadMessageCount(userId) {
    try {
      if (!userId) return 0;

      const { data, error } = await supabase
        .from(TABLES.MESSAGES)
        .select('id')
        .eq('receiver_id', userId)
        .eq('is_read', false);

      if (error) {
        console.warn('Error fetching unread messages:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.warn('Error in getUnreadMessageCount:', error);
      return 0;
    }
  }

  /**
   * Fetch unread notification count from notification_recipients table
   * @param {string} userId - Current user ID
   * @param {string} userType - User type for filtering
   * @returns {Promise<number>} - Number of unread notifications
   */
  async getUnreadNotificationCount(userId, userType) {
    try {
      if (!userId || !userType) return 0;

      const tenantId = await getUserTenantId();
      if (!tenantId) return 0;

      const recipientType = this.getUserTypeForDB(userType);

      // Get unread notifications with filtering similar to the screens
      const { data: notificationData, error } = await supabase
        .from(TABLES.NOTIFICATION_RECIPIENTS)
        .select(`
          id,
          is_read,
          notifications(
            id,
            message,
            type,
            delivery_status,
            delivery_mode
          )
        `)
        .eq('recipient_id', userId)
        .eq('recipient_type', recipientType)
        .eq('tenant_id', tenantId)
        .eq('is_read', false);

      if (error) {
        console.warn('Error fetching unread notifications:', error);
        return 0;
      }

      if (!notificationData || notificationData.length === 0) {
        return 0;
      }

      // Apply filtering logic similar to existing screens
      let filteredNotifications = notificationData.filter(record => {
        const notification = record.notifications;
        if (!notification || !notification.message) return false;
        
        const message = notification.message.toLowerCase();
        
        // Only filter out automatic/system leave notifications, but keep leave status updates
        // Keep: "Leave request approved", "Leave request denied", "Leave application processed"
        // Filter: "Employee is absent", "Student on leave today", etc.
        const isSystemLeaveNotification = (
          (message.includes('absent') && !message.includes('request')) ||
          (message.includes('on leave') && !message.includes('request')) ||
          (message.includes('vacation') && !message.includes('request')) ||
          (message.includes('time off') && !message.includes('request'))
        );
        
        // Keep important leave-related notifications (approvals, denials, etc.)
        const isImportantLeaveNotification = (
          message.includes('approved') ||
          message.includes('denied') ||
          message.includes('rejected') ||
          message.includes('processed') ||
          message.includes('pending') ||
          message.includes('submitted')
        );
        
        if (isSystemLeaveNotification && !isImportantLeaveNotification) {
          return false;
        }
        
        return true;
      });

      // Additional filtering for student notifications based on class
      if (userType === 'student') {
        try {
          const { data: studentData, error: studentError } = await supabase
            .from(TABLES.STUDENTS)
            .select('id, class_id, classes(id, class_name, section)')
            .eq('id', userId) // For students, user ID might be linked to student ID
            .eq('tenant_id', tenantId)
            .single();
            
          if (!studentError && studentData?.classes?.class_name) {
            const studentClass = studentData.classes.class_name;
            
            filteredNotifications = filteredNotifications.filter(record => {
              const message = record.notifications.message.toLowerCase();
              
              // Look for class mentions in the message
              const classPatterns = [
                /class\s+(\d+|[ivxlc]+)/gi,
                /grade\s+(\d+|[ivxlc]+)/gi,
                /(\d+)(st|nd|rd|th)\s*class/gi,
                /for\s+class\s+(\d+|[ivxlc]+)/gi,
              ];
              
              for (const pattern of classPatterns) {
                const matches = [...message.matchAll(pattern)];
                for (const match of matches) {
                  const mentionedClass = match[1]?.toLowerCase();
                  if (mentionedClass && mentionedClass !== studentClass.toLowerCase()) {
                    return false;
                  }
                }
              }
              
              return true;
            });
          }
        } catch (err) {
          console.warn('Could not fetch student class info for filtering:', err);
        }
      }

      return filteredNotifications.length;
    } catch (error) {
      console.warn('Error in getUnreadNotificationCount:', error);
      return 0;
    }
  }

  /**
   * Get total unread count (messages + notifications) for a user
   * @param {string} userId - Current user ID
   * @param {string} userType - User type for filtering
   * @returns {Promise<{messageCount: number, notificationCount: number, totalCount: number}>}
   */
  async getUnreadCounts(userId, userType) {
    try {
      if (!userId || !userType) {
        return { messageCount: 0, notificationCount: 0, totalCount: 0 };
      }

      // Check cache first
      const cacheKey = `${userId}-${userType}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Fetch both counts in parallel
      const [messageCount, notificationCount] = await Promise.all([
        this.getUnreadMessageCount(userId),
        this.getUnreadNotificationCount(userId, userType)
      ]);

      const result = {
        messageCount,
        notificationCount,
        totalCount: messageCount + notificationCount
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.warn('Error in getUnreadCounts:', error);
      return { messageCount: 0, notificationCount: 0, totalCount: 0 };
    }
  }

  /**
   * Clear cache for a specific user
   * @param {string} userId - User ID to clear cache for
   * @param {string} userType - User type to clear cache for
   */
  clearCache(userId, userType) {
    if (userId && userType) {
      const cacheKey = `${userId}-${userType}`;
      this.cache.delete(cacheKey);
    }
  }

  /**
   * Clear all cache
   */
  clearAllCache() {
    this.cache.clear();
  }

  /**
   * Set up ultra-fast real-time subscription for a user
   * @param {string} userId - User ID to subscribe for
   * @param {string} userType - User type for filtering
   * @param {Function} callback - Callback function to call when counts change
   * @returns {Function} - Unsubscribe function
   */
  subscribeToUpdates(userId, userType, callback) {
    if (!userId || !userType) return () => {};

    const subscriptionKey = `${userId}-${userType}`;
    console.log(`🔔 [UniversalNotificationService] Setting up real-time subscription for ${subscriptionKey}`);
    
    // Store callback for reconnection scenarios
    this.realTimeCallbacks.set(subscriptionKey, callback);
    
    // Clean up existing subscription
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`🔄 [UniversalNotificationService] Cleaning up existing subscription for ${subscriptionKey}`);
      this.subscriptions.get(subscriptionKey)();
    }

    // Create multiple channels for different types of updates (faster response)
    const channels = [];
    const channelId = Date.now();
    
    // Channel 1: Messages updates
    const messagesChannel = supabase.channel(`msg-${subscriptionKey}-${channelId}`);
    messagesChannel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.MESSAGES,
      filter: `receiver_id=eq.${userId}`
    }, (payload) => {
      console.log(`📨 [UniversalNotificationService] Message update for ${userId}:`, payload.eventType);
      this.clearCache(userId, userType);
      // Immediate callback for instant UI update
      setTimeout(() => callback('message_update'), 10);
    });
    channels.push(messagesChannel);

    // Channel 2: Notification recipients updates (including NEW notifications)
    const notificationChannel = supabase.channel(`notif-${subscriptionKey}-${channelId}`);
    notificationChannel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: TABLES.NOTIFICATION_RECIPIENTS,
      filter: `recipient_id=eq.${userId}`
    }, (payload) => {
      console.log(`🔔 [UniversalNotificationService] Notification recipient update for ${userId}:`, payload.eventType, payload.new?.notification_id);
      this.clearCache(userId, userType);
      
      // Handle different types of notification recipient events
      if (payload.eventType === 'INSERT') {
        console.log(`🆕 [UniversalNotificationService] NEW notification received for ${userId}`);
        // New notification for this user - immediate callback
        callback('new_notification_for_user');
      } else if (payload.eventType === 'UPDATE') {
        console.log(`📝 [UniversalNotificationService] Notification status updated for ${userId}`);
        // Notification status changed (e.g., marked as read) - quick callback
        setTimeout(() => callback('notification_status_update'), 10);
      } else {
        // Other changes - standard callback
        setTimeout(() => callback('notification_update'), 10);
      }
    });
    channels.push(notificationChannel);

    // Channel 3: Direct notifications table updates (for new notifications)
    const directNotificationChannel = supabase.channel(`direct-notif-${subscriptionKey}-${channelId}`);
    directNotificationChannel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: TABLES.NOTIFICATIONS
    }, (payload) => {
      console.log(`🆕 [UniversalNotificationService] New notification created:`, payload.new?.type);
      // Clear cache immediately for all users (new notification might affect multiple users)
      this.clearAllCache();
      setTimeout(() => callback('new_notification'), 10);
    });
    channels.push(directNotificationChannel);

    // Channel 4: Broadcast events for instant updates
    const broadcastChannel = supabase.channel(`broadcast-${subscriptionKey}-${channelId}`);
    
    // Listen for notification read broadcasts
    broadcastChannel.on('broadcast', { event: 'notification-read' }, (payload) => {
      console.log(`📖 [UniversalNotificationService] Notification read broadcast:`, payload.payload);
      if (payload.payload.user_id === userId) {
        this.clearCache(userId, userType);
        // Instant update with no delay
        callback('notification_read_broadcast');
      }
    });

    // Listen for message read broadcasts
    broadcastChannel.on('broadcast', { event: 'message-read' }, (payload) => {
      console.log(`💬 [UniversalNotificationService] Message read broadcast:`, payload.payload);
      if (payload.payload.user_id === userId) {
        this.clearCache(userId, userType);
        // Instant update with no delay
        callback('message_read_broadcast');
      }
    });

    // Listen for bulk updates (e.g., admin marking multiple notifications as read)
    broadcastChannel.on('broadcast', { event: 'bulk-update' }, (payload) => {
      console.log(`📦 [UniversalNotificationService] Bulk update broadcast:`, payload.payload);
      const affectedUsers = payload.payload.affected_users || [];
      if (affectedUsers.includes(userId) || payload.payload.all_users) {
        this.clearCache(userId, userType);
        callback('bulk_update');
      }
    });

    // Listen for real-time count updates (direct count pushes)
    broadcastChannel.on('broadcast', { event: 'count-update' }, (payload) => {
      if (payload.payload.user_id === userId) {
        console.log(`🔢 [UniversalNotificationService] Direct count update:`, payload.payload.counts);
        const cacheKey = `${userId}-${userType}`;
        this.cache.set(cacheKey, {
          data: payload.payload.counts,
          timestamp: Date.now()
        });
        callback('direct_count_update');
      }
    });

    // Listen for new notification broadcasts (when admin creates notifications)
    broadcastChannel.on('broadcast', { event: 'new-notification-for-user' }, (payload) => {
      if (payload.payload.user_id === userId) {
        console.log(`🆕 [UniversalNotificationService] New notification broadcast for user:`, payload.payload);
        this.clearCache(userId, userType);
        // Immediate callback for new notification
        callback('new_notification_for_user');
      }
    });
    
    channels.push(broadcastChannel);

    // Subscribe to all channels with retry logic
    const subscribeWithRetry = async (channel, retryCount = 0) => {
      try {
        await channel.subscribe((status) => {
          console.log(`📡 [UniversalNotificationService] Channel ${channel.topic} status:`, status);
          if (status === 'CHANNEL_ERROR' && retryCount < this.maxRetries) {
            console.log(`🔄 [UniversalNotificationService] Retrying subscription for ${channel.topic} (${retryCount + 1}/${this.maxRetries})`);
            setTimeout(() => subscribeWithRetry(channel, retryCount + 1), 1000 * (retryCount + 1));
          }
        });
      } catch (error) {
        console.error(`❌ [UniversalNotificationService] Error subscribing to ${channel.topic}:`, error);
        if (retryCount < this.maxRetries) {
          setTimeout(() => subscribeWithRetry(channel, retryCount + 1), 2000);
        }
      }
    };

    // Subscribe to all channels
    channels.forEach(channel => subscribeWithRetry(channel));

    // Create comprehensive unsubscribe function
    const unsubscribe = () => {
      console.log(`🚫 [UniversalNotificationService] Unsubscribing from all channels for ${subscriptionKey}`);
      channels.forEach(channel => {
        try {
          channel.unsubscribe();
        } catch (error) {
          console.warn(`Error unsubscribing from ${channel.topic}:`, error);
        }
      });
      this.subscriptions.delete(subscriptionKey);
      this.realTimeCallbacks.delete(subscriptionKey);
      this.retryAttempts.delete(subscriptionKey);
    };

    // Store the unsubscribe function
    this.subscriptions.set(subscriptionKey, unsubscribe);
    console.log(`✅ [UniversalNotificationService] Real-time subscription setup complete for ${subscriptionKey}`);

    return unsubscribe;
  }

  /**
   * Broadcast a notification read event
   * @param {string} userId - User ID who read the notification
   * @param {string} notificationId - ID of the notification that was read
   */
  async broadcastNotificationRead(userId, notificationId) {
    try {
      const channel = supabase.channel('universal-notification-update');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'notification-read',
        payload: {
          user_id: userId,
          notification_id: notificationId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Clear cache immediately
      this.cache.forEach((value, key) => {
        if (key.startsWith(userId)) {
          this.cache.delete(key);
        }
      });
    } catch (error) {
      console.warn('Error broadcasting notification read:', error);
    }
  }

  /**
   * Broadcast a message read event
   * @param {string} userId - User ID who read the message
   * @param {string} senderId - ID of the message sender
   */
  async broadcastMessageRead(userId, senderId) {
    try {
      const channel = supabase.channel('universal-message-update');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'message-read',
        payload: {
          user_id: userId,
          sender_id: senderId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Clear cache immediately
      this.cache.forEach((value, key) => {
        if (key.startsWith(userId)) {
          this.cache.delete(key);
        }
      });
    } catch (error) {
      console.warn('Error broadcasting message read:', error);
    }
  }

  /**
   * Broadcast a bulk update event (for admin operations affecting multiple users)
   * @param {Array<string>} userIds - Array of user IDs affected
   * @param {string} operation - Type of operation performed
   * @param {boolean} allUsers - Whether all users are affected
   */
  async broadcastBulkUpdate(userIds = [], operation = 'bulk_update', allUsers = false) {
    try {
      console.log(`📦 [UniversalNotificationService] Broadcasting bulk update:`, { userIds, operation, allUsers });
      
      const channel = supabase.channel('universal-bulk-update');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'bulk-update',
        payload: {
          affected_users: userIds,
          operation,
          all_users: allUsers,
          timestamp: new Date().toISOString()
        }
      });
      
      // Clear relevant caches
      if (allUsers) {
        this.clearAllCache();
      } else {
        userIds.forEach(userId => {
          this.cache.forEach((value, key) => {
            if (key.startsWith(userId)) {
              this.cache.delete(key);
            }
          });
        });
      }
      
      console.log(`✅ [UniversalNotificationService] Bulk update broadcast sent successfully`);
    } catch (error) {
      console.warn('Error broadcasting bulk update:', error);
    }
  }

  /**
   * Broadcast direct count update (push counts directly to users)
   * @param {string} userId - User ID to send counts to
   * @param {Object} counts - Count data to send
   */
  async broadcastDirectCountUpdate(userId, counts) {
    try {
      console.log(`🔢 [UniversalNotificationService] Broadcasting direct count update for ${userId}:`, counts);
      
      const channel = supabase.channel('universal-count-update');
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'count-update',
        payload: {
          user_id: userId,
          counts,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log(`✅ [UniversalNotificationService] Direct count update sent successfully`);
    } catch (error) {
      console.warn('Error broadcasting direct count update:', error);
    }
  }

  /**
   * Get cached counts immediately or fetch if not available
   * @param {string} userId - User ID
   * @param {string} userType - User type
   * @param {boolean} forceRefresh - Whether to force refresh
   * @returns {Promise<{messageCount: number, notificationCount: number, totalCount: number}>}
   */
  async getUnreadCountsFast(userId, userType, forceRefresh = false) {
    const cacheKey = `${userId}-${userType}`;
    
    // If not forcing refresh, check cache first (even if expired for instant response)
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        // Return cached data immediately, but refresh in background if expired
        if (Date.now() - cached.timestamp >= this.cacheTimeout) {
          // Background refresh without waiting
          this.getUnreadCounts(userId, userType).catch(err => 
            console.warn('Background refresh failed:', err)
          );
        }
        return cached.data;
      }
    }
    
    // Fetch fresh data
    return await this.getUnreadCounts(userId, userType);
  }

  /**
   * Preload counts for multiple users (for admin dashboard optimization)
   * @param {Array<{userId: string, userType: string}>} users - Array of users to preload
   */
  async preloadCounts(users) {
    try {
      console.log(`⚡ [UniversalNotificationService] Preloading counts for ${users.length} users`);
      
      const promises = users.map(({ userId, userType }) => 
        this.getUnreadCounts(userId, userType).catch(err => {
          console.warn(`Failed to preload for ${userId}-${userType}:`, err);
          return { messageCount: 0, notificationCount: 0, totalCount: 0 };
        })
      );
      
      await Promise.all(promises);
      console.log(`✅ [UniversalNotificationService] Preloading complete`);
    } catch (error) {
      console.warn('Error preloading counts:', error);
    }
  }

  /**
   * Broadcast new notification to specific users (for when admin creates notifications)
   * @param {Array<string>} userIds - Array of user IDs who received the notification
   * @param {string} notificationId - ID of the new notification
   * @param {string} notificationType - Type of notification
   */
  async broadcastNewNotificationToUsers(userIds, notificationId, notificationType = 'General') {
    try {
      console.log(`🆕 [UniversalNotificationService] Broadcasting new notification to ${userIds.length} users:`, { notificationId, notificationType });
      
      const channel = supabase.channel('universal-new-notification');
      await channel.subscribe();
      
      // Send individual broadcasts for each user for precise targeting
      for (const userId of userIds) {
        await channel.send({
          type: 'broadcast',
          event: 'new-notification-for-user',
          payload: {
            user_id: userId,
            notification_id: notificationId,
            notification_type: notificationType,
            timestamp: new Date().toISOString()
          }
        });
        
        // Also clear cache for this user
        this.cache.forEach((value, key) => {
          if (key.startsWith(userId)) {
            this.cache.delete(key);
          }
        });
      }
      
      console.log(`✅ [UniversalNotificationService] New notification broadcast sent to ${userIds.length} users`);
    } catch (error) {
      console.warn('Error broadcasting new notification to users:', error);
    }
  }

  /**
   * Handle notification recipient record creation (call this when notification recipients are created)
   * @param {string} userId - User ID who received the notification
   * @param {string} notificationId - ID of the notification
   * @param {string} userType - Type of user (student, parent, admin, teacher)
   */
  async handleNewNotificationRecipient(userId, notificationId, userType) {
    try {
      console.log(`📨 [UniversalNotificationService] New notification recipient record:`, { userId, notificationId, userType });
      
      // Clear cache immediately for this user
      this.clearCache(userId, userType);
      
      // Broadcast direct count update to this user
      const counts = await this.getUnreadCounts(userId, userType);
      await this.broadcastDirectCountUpdate(userId, counts);
      
      console.log(`✅ [UniversalNotificationService] Handled new notification recipient for ${userId}`);
    } catch (error) {
      console.warn('Error handling new notification recipient:', error);
    }
  }
}

// Export singleton instance
export const universalNotificationService = new UniversalNotificationService();
export default universalNotificationService;
