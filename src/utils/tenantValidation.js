/**
 * 🛡️ TENANT VALIDATION UTILITY
 * Centralized utility for strict tenant isolation across the entire application
 */

import { supabase } from './supabase';

// Cache for tenant validation results (1 minute TTL)
const validationCache = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute

const getCacheKey = (tenantId, userId) => `${tenantId}_${userId}`;

/**
 * Validates tenant access and returns tenant information
 * @param {string} tenantId - The tenant ID to validate
 * @param {string} userId - The user ID making the request
 * @param {string} screenName - Name of the screen/component for logging
 * @returns {Promise<{isValid: boolean, tenant: object|null, error: string|null}>}
 */
export const validateTenantAccess = async (userId, tenantId, screenName = 'Unknown') => {
  // Check cache first
  const cacheKey = getCacheKey(tenantId, userId);
  const cached = validationCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.result;
  }
  
  // Step 1: Check if user ID is provided
  if (!userId) {
    return {
      isValid: false,
      tenant: null,
      error: 'User not authenticated.'
    };
  }
  
  // Step 2: Check if tenant ID is provided
  if (!tenantId) {
    return {
      isValid: false,
      tenant: null,
      error: 'No tenant context available. Please contact administrator.'
    };
  }
  
  try {
    // Step 3: Verify tenant exists and is active
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, status, subdomain')
      .eq('id', tenantId)
      .eq('status', 'active')
      .single();
    
    if (tenantError || !tenant) {
      return {
        isValid: false,
        tenant: null,
        error: `Invalid or inactive tenant: ${tenantId}`
      };
    }
    
    // Step 4: Verify user belongs to this tenant
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('tenant_id, email')
      .eq('id', userId)
      .single();
    
    if (userError || !userRecord) {
      return {
        isValid: false,
        tenant: null,
        error: 'User record not found.'
      };
    }
    
    if (userRecord.tenant_id !== tenantId) {
      return {
        isValid: false,
        tenant: null,
        error: 'Access denied: User does not belong to this tenant.'
      };
    }
    
    const result = {
      isValid: true,
      tenant: tenant,
      error: null
    };
    
    // Cache the successful result
    validationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    return {
      isValid: false,
      tenant: null,
      error: `Tenant validation failed: ${error.message}`
    };
  }
};

/**
 * Creates a tenant-aware Supabase query builder
 * Automatically adds tenant_id filter to queries
 */
export class TenantAwareQueryBuilder {
  constructor(tenantId, tableName) {
    this.tenantId = tenantId;
    this.tableName = tableName;
    this.baseQuery = null;
    this.currentQuery = null;
    
    // Validate inputs
    if (!tenantId) {
      throw new Error('tenantId is required for TenantAwareQueryBuilder');
    }
    if (!tableName) {
      throw new Error('tableName is required for TenantAwareQueryBuilder');
    }
    
    try {
      if (!supabase || typeof supabase.from !== 'function') {
        throw new Error(`Supabase client invalid`);
      }
      
      this.baseQuery = supabase.from(tableName);
      
      if (!this.baseQuery || typeof this.baseQuery.select !== 'function') {
        throw new Error(`Failed to create base query for table '${tableName}'`);
      }
    } catch (error) {
      throw new Error(`Failed to create tenant-aware query for table '${tableName}': ${error.message}`);
    }
  }
  
  select(columns = '*') {
    if (!this.baseQuery) {
      throw new Error(`Base query not initialized for table '${this.tableName}'`);
    }
    
    // CORRECT PATTERN: .from() → .select() → .eq()
    const selectedQuery = this.baseQuery.select(columns);
    
    if (typeof selectedQuery.eq !== 'function') {
      throw new Error(`Selected query for '${this.tableName}' is missing .eq() method`);
    }
    
    // Automatically apply tenant filter after select
    this.currentQuery = selectedQuery.eq('tenant_id', this.tenantId);
    
    return this;
  }
  
  eq(column, value) {
    if (!this.currentQuery || typeof this.currentQuery.eq !== 'function') {
      throw new Error(`Query not properly initialized for table '${this.tableName}' or .eq() not available. Call .select() first.`);
    }
    this.currentQuery = this.currentQuery.eq(column, value);
    return this;
  }
  
  neq(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.neq(column, value);
    return this;
  }
  
  gt(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.gt(column, value);
    return this;
  }
  
  gte(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.gte(column, value);
    return this;
  }
  
  lt(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.lt(column, value);
    return this;
  }
  
  lte(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.lte(column, value);
    return this;
  }
  
  in(column, values) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.in(column, values);
    return this;
  }
  
  or(query) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.or(query);
    return this;
  }
  
  order(column, options) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.order(column, options);
    return this;
  }
  
  limit(count) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.limit(count);
    return this;
  }
  
  range(from, to) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.range(from, to);
    return this;
  }
  
  single() {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.single();
    return this;
  }
  
  overlaps(column, values) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.overlaps(column, values);
    return this;
  }
  
  contains(column, values) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.contains(column, values);
    return this;
  }
  
  containedBy(column, values) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.containedBy(column, values);
    return this;
  }
  
  like(column, pattern) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.like(column, pattern);
    return this;
  }
  
  ilike(column, pattern) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.ilike(column, pattern);
    return this;
  }
  
  is(column, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.is(column, value);
    return this;
  }
  
  not(column, operator, value) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.not(column, operator, value);
    return this;
  }
  
  or(filters) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.or(filters);
    return this;
  }
  
  and(filters) {
    if (!this.currentQuery) throw new Error('Call .select() first');
    this.currentQuery = this.currentQuery.and(filters);
    return this;
  }
  
  // UPDATE operations
  update(data) {
    if (!this.baseQuery) {
      throw new Error(`Base query not initialized for table '${this.tableName}'`);
    }
    
    // Ensure tenant_id is included in update data
    const updatedData = { ...data, tenant_id: this.tenantId };
    
    // Start with update and apply tenant filter
    this.currentQuery = this.baseQuery.update(updatedData).eq('tenant_id', this.tenantId);
    
    return this;
  }
  
  // INSERT operations
  insert(data) {
    if (!this.baseQuery) {
      throw new Error(`Base query not initialized for table '${this.tableName}'`);
    }
    
    // Ensure tenant_id is included in all insert data
    let insertData;
    if (Array.isArray(data)) {
      insertData = data.map(item => ({ ...item, tenant_id: this.tenantId }));
    } else {
      insertData = { ...data, tenant_id: this.tenantId };
    }
    
    this.currentQuery = this.baseQuery.insert(insertData);
    
    return this;
  }
  
  // DELETE operations
  delete() {
    if (!this.baseQuery) {
      throw new Error(`Base query not initialized for table '${this.tableName}'`);
    }
    
    // Start with delete and apply tenant filter
    this.currentQuery = this.baseQuery.delete().eq('tenant_id', this.tenantId);
    
    return this;
  }
  
  // Execute the query
  async execute() {
    if (!this.currentQuery) {
      throw new Error(`Query not properly initialized for table '${this.tableName}'. Call .select(), .update(), .insert(), or .delete() first.`);
    }
    
    console.log(`🔍 [TENANT_QUERY] Executing query for table '${this.tableName}' with tenant_id: ${this.tenantId}`);
    
    try {
      const result = await this.currentQuery;
      console.log(`✅ [TENANT_QUERY] Query completed for '${this.tableName}':`, {
        recordCount: result.data?.length || 0,
        error: result.error?.message || null
      });
      return result;
    } catch (error) {
      console.error(`❌ [TENANT_QUERY] Query execution failed for '${this.tableName}':`, error);
      throw error;
    }
  }
}

/**
 * Creates a tenant-aware query for any table
 * @param {string} tenantId - The tenant ID
 * @param {string} tableName - The table name
 * @returns {TenantAwareQueryBuilder}
 */
export const createTenantQuery = (tenantId, tableName) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required for tenant-aware queries');
  }
  return new TenantAwareQueryBuilder(tenantId, tableName);
};

/**
 * Validates that data belongs to the specified tenant
 * Used for additional security checks
 * @param {object} data - The data object to validate
 * @param {string} expectedTenantId - The expected tenant ID
 * @param {string} context - Context for logging
 * @returns {boolean}
 */
export const validateDataTenancy = (data, expectedTenantId, context = 'Unknown') => {
  if (!data) {
    console.warn(`⚠️ [TENANT_DATA_VALIDATION] ${context}: No data to validate`);
    return false;
  }
  
  if (Array.isArray(data)) {
    // Validate array of data
    const invalidItems = data.filter(item => item.tenant_id !== expectedTenantId);
    if (invalidItems.length > 0) {
      console.error(`❌ [TENANT_DATA_VALIDATION] ${context}: Found ${invalidItems.length} items with wrong tenant_id`);
      return false;
    }
    console.log(`✅ [TENANT_DATA_VALIDATION] ${context}: All ${data.length} items have correct tenant_id`);
    return true;
  } else {
    // Validate single data object
    if (data.tenant_id !== expectedTenantId) {
      console.error(`❌ [TENANT_DATA_VALIDATION] ${context}: Data has wrong tenant_id:`, {
        expected: expectedTenantId,
        actual: data.tenant_id
      });
      return false;
    }
    console.log(`✅ [TENANT_DATA_VALIDATION] ${context}: Data has correct tenant_id`);
    return true;
  }
};

/**
 * Validate notification access for current user
 * @param {string} notificationId - Notification ID to validate
 * @param {string} userId - Current user ID
 * @returns {Promise<Object>} Validation result
 */
export const validateNotificationAccess = async (notificationId, userId) => {
  try {
    console.log(`🔔 [NOTIF_VALIDATION] Validating notification access: ${notificationId}`);
    
    // Get notification with tenant info
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('id, tenant_id, type, message, created_at')
      .eq('id', notificationId)
      .single();
    
    if (notifError || !notification) {
      return {
        isValid: false,
        error: 'Notification not found',
        notification: null
      };
    }
    
    // Validate tenant access
    const tenantValidation = await validateTenantAccess(notification.tenant_id, userId, 'NotificationAccess');
    if (!tenantValidation.isValid) {
      return {
        isValid: false,
        error: tenantValidation.error,
        notification: null
      };
    }
    
    console.log(`✅ [NOTIF_VALIDATION] Notification access validated for tenant: ${tenantValidation.tenant.name}`);
    
    return {
      isValid: true,
      notification,
      tenant: tenantValidation.tenant,
      error: null
    };
    
  } catch (error) {
    console.error(`❌ [NOTIF_VALIDATION] Exception in validateNotificationAccess:`, error);
    return {
      isValid: false,
      error: `Validation exception: ${error.message}`,
      notification: null
    };
  }
};

/**
 * Validate notification recipients belong to the same tenant
 * @param {Array} recipientIds - Array of recipient user IDs
 * @param {string} tenantId - Expected tenant ID
 * @returns {Promise<Object>} Validation result
 */
export const validateNotificationRecipients = async (recipientIds, tenantId) => {
  try {
    console.log(`👥 [RECIPIENT_VALIDATION] Validating ${recipientIds.length} recipients for tenant: ${tenantId}`);
    
    if (!recipientIds || recipientIds.length === 0) {
      return {
        isValid: false,
        error: 'No recipients provided'
      };
    }
    
    // Get all recipient users and check their tenant assignment
    const { data: recipients, error: recipientsError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name')
      .in('id', recipientIds);
    
    if (recipientsError) {
      return {
        isValid: false,
        error: `Error fetching recipients: ${recipientsError.message}`
      };
    }
    
    // Check if all recipients were found
    const foundIds = recipients.map(r => r.id);
    const missingIds = recipientIds.filter(id => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      return {
        isValid: false,
        error: `Recipients not found: ${missingIds.join(', ')}`
      };
    }
    
    // Check if all recipients belong to the expected tenant
    const wrongTenantRecipients = recipients.filter(r => r.tenant_id !== tenantId);
    
    if (wrongTenantRecipients.length > 0) {
      console.error(`❌ [RECIPIENT_VALIDATION] Recipients belong to wrong tenant:`, 
        wrongTenantRecipients.map(r => ({ email: r.email, tenant: r.tenant_id }))
      );
      return {
        isValid: false,
        error: 'Some recipients do not belong to your organization'
      };
    }
    
    console.log(`✅ [RECIPIENT_VALIDATION] All ${recipients.length} recipients validated for tenant ${tenantId}`);
    
    return {
      isValid: true,
      recipients,
      validatedCount: recipients.length
    };
    
  } catch (error) {
    console.error(`❌ [RECIPIENT_VALIDATION] Exception:`, error);
    return {
      isValid: false,
      error: `Validation exception: ${error.message}`
    };
  }
};

/**
 * Create tenant-aware notification queries with automatic filtering
 * @param {string} tenantId - Tenant ID for filtering
 * @returns {Object} Query builders for different notification tables
 */
export const createNotificationQueries = (tenantId) => {
  if (!tenantId) {
    throw new Error('Tenant ID is required for notification queries');
  }
  
  return {
    notifications: () => createTenantQuery(tenantId, 'notifications'),
    recipients: () => createTenantQuery(tenantId, 'notification_recipients'),
    
    // Helper for getting user notifications with recipients
    userNotifications: (userId) => {
      return supabase
        .from('notification_recipients')
        .select(`
          *,
          notifications!inner(
            id,
            type,
            message,
            delivery_status,
            created_at,
            tenant_id
          )
        `)
        .eq('recipient_id', userId)
        .eq('tenant_id', tenantId)
        .eq('notifications.tenant_id', tenantId); // Double check tenant isolation
    }
  };
};

/**
 * Error messages for tenant validation failures
 */
export const TENANT_ERROR_MESSAGES = {
  NO_TENANT: 'No tenant context available. Please contact administrator.',
  NO_USER: 'User not authenticated.',
  INVALID_TENANT: 'Invalid or inactive tenant.',
  ACCESS_DENIED: 'Access denied: User does not belong to this tenant.',
  VALIDATION_FAILED: 'Tenant validation failed.',
  WRONG_TENANT_DATA: 'Data does not belong to your tenant.',
  NOTIFICATION_ACCESS_DENIED: 'Access denied: Notification does not belong to your organization.',
  RECIPIENTS_VALIDATION_FAILED: 'Some recipients do not belong to your organization.'
};
