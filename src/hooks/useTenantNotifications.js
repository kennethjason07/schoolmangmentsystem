/**
 * React Hook for Tenant-Filtered Notifications
 * 
 * This hook provides an easy way for React components to access
 * notifications that are strictly filtered by the current tenant.
 * It ensures that users can ONLY see notifications from their organization.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getUserTenantFilteredNotifications, 
  getTenantFilteredUnreadCount,
  markTenantNotificationAsRead,
  getCurrentTenantId 
} from '../utils/tenantNotificationFilter';

/**
 * Hook to get tenant-filtered notifications for the current user
 * @param {string} userId - Current user ID
 * @param {Object} options - Options for filtering
 * @returns {Object} { notifications, unreadCount, loading, error, refresh, markAsRead }
 */
export const useTenantNotifications = (userId, options = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);

  const {
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
    unreadOnly = false,
    limit = 50
  } = options;

  /**
   * Load notifications with tenant filtering
   */
  const loadNotifications = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      setError(null);

      console.log(`🔔 [useTenantNotifications] Loading notifications for user: ${userId}`);

      // Get tenant info
      const tenantResult = await getCurrentTenantId();
      if (tenantResult.tenantId) {
        setTenantInfo({
          tenantId: tenantResult.tenantId,
          tenantName: tenantResult.tenantName
        });
      }

      // Load tenant-filtered notifications
      const notificationsResult = await getUserTenantFilteredNotifications(userId, {
        unreadOnly,
        limit
      });

      if (notificationsResult.error) {
        setError(notificationsResult.error);
        console.error('❌ [useTenantNotifications] Error loading notifications:', notificationsResult.error);
        return;
      }

      setNotifications(notificationsResult.data);
      console.log(`✅ [useTenantNotifications] Loaded ${notificationsResult.data.length} notifications for tenant: ${notificationsResult.tenantName}`);

      // Load unread count if not filtering by unread only
      if (!unreadOnly) {
        const count = await getTenantFilteredUnreadCount(userId);
        setUnreadCount(count);
        console.log(`✅ [useTenantNotifications] Unread count: ${count}`);
      } else {
        setUnreadCount(notificationsResult.data.length);
      }

    } catch (err) {
      console.error('❌ [useTenantNotifications] Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, unreadOnly, limit]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (notificationId) => {
    try {
      console.log(`📖 [useTenantNotifications] Marking notification as read: ${notificationId}`);

      const result = await markTenantNotificationAsRead(notificationId, userId);
      
      if (!result.success) {
        console.error('❌ [useTenantNotifications] Failed to mark as read:', result.error);
        return { success: false, error: result.error };
      }

      // Update local state
      setNotifications(prev => prev.map(notif => 
        notif.id === notificationId 
          ? { 
              ...notif, 
              recipient_info: { 
                ...notif.recipient_info, 
                is_read: true 
              }
            }
          : notif
      ));

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));

      console.log(`✅ [useTenantNotifications] Successfully marked notification as read`);
      return { success: true };

    } catch (error) {
      console.error('❌ [useTenantNotifications] Exception in markAsRead:', error);
      return { success: false, error: error.message };
    }
  }, [userId]);

  /**
   * Refresh notifications
   */
  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  /**
   * Get notifications filtered by type
   */
  const getNotificationsByType = useCallback((type) => {
    return notifications.filter(notification => notification.type === type);
  }, [notifications]);

  /**
   * Get recent notifications (last 24 hours)
   */
  const getRecentNotifications = useCallback(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return notifications.filter(notification => {
      const createdAt = new Date(notification.created_at);
      return createdAt > yesterday;
    });
  }, [notifications]);

  // Load notifications on mount and when dependencies change
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh || !userId) return;

    const interval = setInterval(() => {
      loadNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadNotifications, userId]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    tenantInfo,
    refresh,
    markAsRead,
    getNotificationsByType,
    getRecentNotifications,
    // Helper computed properties
    hasNotifications: notifications.length > 0,
    hasUnreadNotifications: unreadCount > 0,
    totalNotifications: notifications.length
  };
};

/**
 * Hook to get tenant-filtered notifications for admin view
 * @param {Object} options - Options for filtering
 * @returns {Object} { notifications, loading, error, refresh }
 */
export const useAdminTenantNotifications = (options = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);

  const {
    type = null,
    status = null,
    limit = 100,
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute for admin
  } = options;

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📊 [useAdminTenantNotifications] Loading admin notifications');

      // Import here to avoid circular dependencies
      const { getTenantFilteredNotifications } = await import('../utils/tenantNotificationFilter');
      
      const result = await getTenantFilteredNotifications({
        type,
        status,
        limit
      });

      if (result.error) {
        setError(result.error);
        console.error('❌ [useAdminTenantNotifications] Error:', result.error);
        return;
      }

      setNotifications(result.data);
      setTenantInfo({
        tenantId: result.tenantId,
        tenantName: result.tenantName
      });

      console.log(`✅ [useAdminTenantNotifications] Loaded ${result.data.length} notifications for tenant: ${result.tenantName}`);

    } catch (err) {
      console.error('❌ [useAdminTenantNotifications] Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type, status, limit]);

  const refresh = useCallback(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Load on mount and dependency changes
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Auto-refresh for admin view
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadNotifications();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadNotifications]);

  return {
    notifications,
    loading,
    error,
    tenantInfo,
    refresh,
    // Helper computed properties
    totalNotifications: notifications.length,
    pendingNotifications: notifications.filter(n => n.delivery_status === 'Pending').length,
    sentNotifications: notifications.filter(n => n.delivery_status === 'Sent').length,
    failedNotifications: notifications.filter(n => n.delivery_status === 'Failed').length
  };
};

export default useTenantNotifications;
