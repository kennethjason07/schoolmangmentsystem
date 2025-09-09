/**
 * Tenant Notification Filter Utility
 * 
 * This utility ensures that ONLY notifications belonging to the current tenant
 * are visible to the logged-in user. It provides a centralized way to get the
 * current tenant_id and filter all notification-related queries.
 */

import { supabase, TABLES } from './supabase';
import { getCurrentUserTenantByEmail } from './getTenantByEmail';

/**
 * Get current tenant ID from multiple sources with fallbacks
 * @returns {Promise<Object>} { tenantId, tenantName, error }
 */
export const getCurrentTenantId = async () => {
  try {
    console.log('🔍 [TENANT_FILTER] Getting current tenant ID...');

    // Method 1: Try email-based tenant lookup (most reliable)
    const emailResult = await getCurrentUserTenantByEmail();
    if (emailResult.success) {
      console.log(`✅ [TENANT_FILTER] Found tenant via email: ${emailResult.data.tenant.name} (${emailResult.data.tenant.id})`);
      return {
        tenantId: emailResult.data.tenant.id,
        tenantName: emailResult.data.tenant.name,
        userRecord: emailResult.data.userRecord,
        error: null
      };
    }

    // Method 2: Direct user lookup fallback
    console.log('⚠️ [TENANT_FILTER] Email lookup failed, trying direct user lookup...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [TENANT_FILTER] No authenticated user found');
      return {
        tenantId: null,
        tenantName: null,
        error: 'No authenticated user found'
      };
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('tenant_id, full_name, email')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      console.error('❌ [TENANT_FILTER] User has no tenant assigned:', userError?.message);
      return {
        tenantId: null,
        tenantName: null,
        error: 'User has no tenant assigned'
      };
    }

    // Get tenant name
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', userRecord.tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error('❌ [TENANT_FILTER] Tenant not found:', tenantError?.message);
      return {
        tenantId: userRecord.tenant_id,
        tenantName: 'Unknown Tenant',
        error: 'Tenant details not found'
      };
    }

    console.log(`✅ [TENANT_FILTER] Found tenant via direct lookup: ${tenant.name} (${tenant.id})`);
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      userRecord,
      error: null
    };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Error getting current tenant ID:', error);
    return {
      tenantId: null,
      tenantName: null,
      error: error.message
    };
  }
};

/**
 * Get filtered notifications for current tenant ONLY
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { data: notifications[], error, tenantId }
 */
export const getTenantFilteredNotifications = async (options = {}) => {
  try {
    console.log('📋 [TENANT_FILTER] Loading tenant-filtered notifications...');

    // Get current tenant ID
    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      console.error('❌ [TENANT_FILTER] Cannot load notifications: No tenant ID');
      return {
        data: [],
        error: tenantResult.error || 'No tenant context available',
        tenantId: null
      };
    }

    console.log(`🔒 [TENANT_FILTER] Filtering notifications for tenant: ${tenantResult.tenantName} (${tenantResult.tenantId})`);

    // Build query with strict tenant filtering
    let query = supabase
      .from(TABLES.NOTIFICATIONS)
      .select(`
        *,
        notification_recipients(
          id,
          recipient_id,
          recipient_type,
          delivery_status,
          sent_at,
          tenant_id,
          is_read
        ),
        users!sent_by(
          id,
          full_name,
          role_id
        )
      `)
      .eq('tenant_id', tenantResult.tenantId); // STRICT: Only current tenant's notifications

    // Apply additional filters
    if (options.type) {
      query = query.eq('type', options.type);
    }
    
    if (options.status) {
      query = query.eq('delivery_status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Always order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('❌ [TENANT_FILTER] Error loading notifications:', error);
      return {
        data: [],
        error: error.message,
        tenantId: tenantResult.tenantId
      };
    }

    // Double-check: Ensure all returned notifications belong to current tenant
    const validNotifications = (data || []).filter(notification => {
      if (notification.tenant_id !== tenantResult.tenantId) {
        console.warn(`⚠️ [TENANT_FILTER] Filtered out notification from wrong tenant: ${notification.id}`);
        return false;
      }
      return true;
    });

    console.log(`✅ [TENANT_FILTER] Successfully loaded ${validNotifications.length} notifications for tenant: ${tenantResult.tenantName}`);

    return {
      data: validNotifications,
      error: null,
      tenantId: tenantResult.tenantId,
      tenantName: tenantResult.tenantName
    };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in getTenantFilteredNotifications:', error);
    return {
      data: [],
      error: error.message,
      tenantId: null
    };
  }
};

/**
 * Get user-specific notifications filtered by tenant
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} { data: notifications[], error, tenantId }
 */
export const getUserTenantFilteredNotifications = async (userId, options = {}) => {
  try {
    console.log(`👤 [TENANT_FILTER] Loading notifications for user: ${userId}`);

    // Get current tenant ID
    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      console.error('❌ [TENANT_FILTER] Cannot load user notifications: No tenant ID');
      return {
        data: [],
        error: tenantResult.error || 'No tenant context available',
        tenantId: null
      };
    }

    console.log(`🔒 [TENANT_FILTER] Filtering user notifications for tenant: ${tenantResult.tenantName}`);

    // Query notification_recipients with tenant filtering
    let query = supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select(`
        *,
        notifications!inner(
          id,
          type,
          message,
          delivery_status,
          created_at,
          tenant_id,
          sent_by
        )
      `)
      .eq('recipient_id', userId)
      .eq('tenant_id', tenantResult.tenantId) // STRICT: Only current tenant
      .eq('notifications.tenant_id', tenantResult.tenantId); // Double filter on notifications table

    // Apply filters
    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    // Order by creation date
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('❌ [TENANT_FILTER] Error loading user notifications:', error);
      return {
        data: [],
        error: error.message,
        tenantId: tenantResult.tenantId
      };
    }

    // Transform and validate data
    const validNotifications = (data || [])
      .filter(recipient => {
        // Ensure both recipient and notification belong to current tenant
        const isValid = recipient.tenant_id === tenantResult.tenantId && 
                       recipient.notifications?.tenant_id === tenantResult.tenantId;
        
        if (!isValid) {
          console.warn(`⚠️ [TENANT_FILTER] Filtered out notification from wrong tenant: ${recipient.id}`);
        }
        
        return isValid;
      })
      .map(recipient => ({
        ...recipient.notifications,
        recipient_info: {
          id: recipient.id,
          is_read: recipient.is_read,
          delivery_status: recipient.delivery_status,
          sent_at: recipient.sent_at
        }
      }));

    console.log(`✅ [TENANT_FILTER] Successfully loaded ${validNotifications.length} user notifications for tenant: ${tenantResult.tenantName}`);

    return {
      data: validNotifications,
      error: null,
      tenantId: tenantResult.tenantId,
      tenantName: tenantResult.tenantName
    };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in getUserTenantFilteredNotifications:', error);
    return {
      data: [],
      error: error.message,
      tenantId: null
    };
  }
};

/**
 * Get unread notification count for current user in current tenant
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread notification count
 */
export const getTenantFilteredUnreadCount = async (userId) => {
  try {
    console.log(`🔢 [TENANT_FILTER] Getting unread count for user: ${userId}`);

    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      console.error('❌ [TENANT_FILTER] Cannot get unread count: No tenant ID');
      return 0;
    }

    const { count, error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('tenant_id', tenantResult.tenantId) // STRICT: Only current tenant
      .eq('is_read', false);

    if (error) {
      console.error('❌ [TENANT_FILTER] Error getting unread count:', error);
      return 0;
    }

    console.log(`✅ [TENANT_FILTER] Unread count for ${tenantResult.tenantName}: ${count || 0}`);
    return count || 0;

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in getTenantFilteredUnreadCount:', error);
    return 0;
  }
};

/**
 * Mark notification as read with tenant validation
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
export const markTenantNotificationAsRead = async (notificationId, userId) => {
  try {
    console.log(`📖 [TENANT_FILTER] Marking notification as read: ${notificationId}`);

    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      return {
        success: false,
        error: 'No tenant context available'
      };
    }

    // Update with tenant validation
    const { error } = await supabase
      .from(TABLES.NOTIFICATION_RECIPIENTS)
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('notification_id', notificationId)
      .eq('recipient_id', userId)
      .eq('tenant_id', tenantResult.tenantId); // STRICT: Only current tenant

    if (error) {
      console.error('❌ [TENANT_FILTER] Error marking notification as read:', error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`✅ [TENANT_FILTER] Marked notification as read for tenant: ${tenantResult.tenantName}`);
    return { success: true };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in markTenantNotificationAsRead:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validate that a notification belongs to the current tenant
 * @param {string} notificationId - Notification ID to validate
 * @returns {Promise<Object>} { isValid: boolean, tenantId?, error? }
 */
export const validateNotificationTenantAccess = async (notificationId) => {
  try {
    console.log(`🔐 [TENANT_FILTER] Validating notification access: ${notificationId}`);

    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      return {
        isValid: false,
        error: 'No tenant context available'
      };
    }

    // Check if notification belongs to current tenant
    const { data: notification, error } = await supabase
      .from(TABLES.NOTIFICATIONS)
      .select('id, tenant_id, type')
      .eq('id', notificationId)
      .eq('tenant_id', tenantResult.tenantId) // STRICT: Only current tenant
      .single();

    if (error || !notification) {
      console.error('❌ [TENANT_FILTER] Notification not found or access denied:', error?.message);
      return {
        isValid: false,
        error: 'Notification not found or access denied'
      };
    }

    console.log(`✅ [TENANT_FILTER] Notification access validated for tenant: ${tenantResult.tenantName}`);
    return {
      isValid: true,
      tenantId: tenantResult.tenantId,
      notification
    };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in validateNotificationTenantAccess:', error);
    return {
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Create a tenant-aware query builder for notifications
 * @param {string} tableName - Table name to query
 * @param {string} selectClause - What to select
 * @returns {Promise<Object>} { query, tenantId, error }
 */
export const createTenantFilteredQuery = async (tableName, selectClause = '*') => {
  try {
    const tenantResult = await getCurrentTenantId();
    if (!tenantResult.tenantId) {
      return {
        query: null,
        tenantId: null,
        error: 'No tenant context available'
      };
    }

    const query = supabase
      .from(tableName)
      .select(selectClause)
      .eq('tenant_id', tenantResult.tenantId); // STRICT: Only current tenant

    return {
      query,
      tenantId: tenantResult.tenantId,
      tenantName: tenantResult.tenantName,
      error: null
    };

  } catch (error) {
    console.error('❌ [TENANT_FILTER] Exception in createTenantFilteredQuery:', error);
    return {
      query: null,
      tenantId: null,
      error: error.message
    };
  }
};

export default {
  getCurrentTenantId,
  getTenantFilteredNotifications,
  getUserTenantFilteredNotifications,
  getTenantFilteredUnreadCount,
  markTenantNotificationAsRead,
  validateNotificationTenantAccess,
  createTenantFilteredQuery
};
