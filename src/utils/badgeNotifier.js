// Simple event emitter for badge notifications
class BadgeNotifier {
  constructor() {
    this.listeners = {};
  }

  // Subscribe to badge refresh events
  subscribe(userId, callback) {
    const key = `badge-refresh-${userId}`;
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    this.listeners[key].push(callback);

    console.log(`📡 BadgeNotifier: Subscribed listener for user ${userId}`);

    // Return unsubscribe function
    return () => {
      this.listeners[key] = this.listeners[key]?.filter(cb => cb !== callback) || [];
      console.log(`📡 BadgeNotifier: Unsubscribed listener for user ${userId}`);
    };
  }

  // Notify all badge listeners for a user to refresh
  notifyBadgeRefresh(userId, reason = 'unknown') {
    const key = `badge-refresh-${userId}`;
    const listeners = this.listeners[key] || [];
    
    console.log(`📡 BadgeNotifier: Notifying ${listeners.length} listeners for user ${userId}, reason: ${reason}`);
    
    listeners.forEach((callback) => {
      try {
        callback(reason);
      } catch (error) {
        console.log('📡 BadgeNotifier: Error calling listener:', error);
      }
    });
  }

  // Notify when a new message is received
  notifyNewMessage(userId, senderId, messageCount = 1) {
    console.log(`📨 BadgeNotifier: New message notification for user ${userId} from ${senderId}`);
    this.notifyBadgeRefresh(userId, 'new-message');
  }

  // Notify when messages are marked as read
  notifyMessagesRead(userId, senderId) {
    console.log(`✅ BadgeNotifier: Messages read notification for user ${userId} from ${senderId}`);
    this.notifyBadgeRefresh(userId, 'messages-read');
  }
}

// Export singleton instance
export const badgeNotifier = new BadgeNotifier();
