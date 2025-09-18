/**
 * 🚀 ENHANCED TENANT HELPERS
 * 
 * Simplified, reliable tenant ID access using cached values from TenantContext.
 * This replaces the need to fetch tenant ID on every database operation.
 */

import React, { useContext } from 'react';
import TenantContext from '../contexts/TenantContext';
import { supabase } from './supabase';

/**
 * 🚀 Hook to get reliable tenant access
 * Use this instead of directly calling getCurrentUserTenantByEmail()
 */
export const useTenantAccess = () => {
  const context = useContext(TenantContext);
  
  if (!context) {
    throw new Error('useTenantAccess must be used within a TenantProvider');
  }

  return {
    // Reliable tenant ID access
    getTenantId: context.getTenantId,
    tenantId: context.tenantId,
    
    // State checks
    isReady: context.isReady,
    isLoading: context.loading,
    tenantInitialized: context.tenantInitialized,
    
    // Tenant info
    tenant: context.currentTenant,
    tenantName: context.tenantName,
    
    // Error handling
    error: context.error,
    
    // Initialization control
    initializeTenant: context.initializeTenant
  };
};

/**
 * 🚀 Get tenant ID synchronously (for use in service functions)
 * This should be used carefully - make sure tenant is initialized first
 */
let _cachedTenantId = null;
let _tenantInitialized = false;

export const setCachedTenantId = (tenantId) => {
  _cachedTenantId = tenantId;
  _tenantInitialized = true;
  console.log('🚀 TenantHelpers: Cached tenant ID set:', tenantId);
};

export const getCachedTenantId = () => {
  if (!_tenantInitialized || !_cachedTenantId) {
    console.warn('⚠️ TenantHelpers: Tenant not initialized yet. Make sure to initialize tenant before using database services.');
    return null;
  }
  return _cachedTenantId;
};

export const clearCachedTenantId = () => {
  _cachedTenantId = null;
  _tenantInitialized = false;
  console.log('🧹 TenantHelpers: Cached tenant ID cleared');
};

/**
 * 🚀 Enhanced database query helper with tenant ID parameter
 * @param {string} tenantId - Tenant ID to filter by
 * @param {string} table - Table name
 * @param {string} selectClause - Select clause (default: '*')
 * @param {Object} filters - Additional filters
 * @returns {Object} Query builder with tenant filter applied
 */
export const createTenantQuery = (tenantId, table, selectClause = '*', filters = {}) => {
  if (!tenantId) {
    throw new Error('No tenant ID provided. Please ensure tenant is initialized.');
  }

  console.log(`🔍 Creating tenant query for '${table}' with tenant_id: ${tenantId}`);
  
  let query = supabase
    .from(table)
    .select(selectClause)
    .eq('tenant_id', tenantId);

  // Apply additional filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  return query;
};

/**
 * 🚀 Alternative query helper that uses cached tenant ID (for backward compatibility)
 * @param {string} table - Table name
 * @param {string} selectClause - Select clause (default: '*')
 * @param {Object} filters - Additional filters
 * @returns {Object} Query builder with tenant filter applied
 */
export const createCachedTenantQuery = (table, selectClause = '*', filters = {}) => {
  const tenantId = getCachedTenantId();
  
  // Check if current user is a parent - parents don't require tenant filtering
  // This is a simplified check - in practice, you might want to pass this as a parameter
  // or check the user's role in a more robust way
  
  console.log(`🔍 Creating tenant query for '${table}' with tenant_id: ${tenantId || 'NOT REQUIRED FOR PARENTS'}`);
  if (!tenantId) {
    throw new Error('No tenant context available. Please ensure user is logged in and tenant is initialized.');
  }

  console.log(`🔍 Creating cached tenant query for '${table}' with tenant_id: ${tenantId}`);
  
  let query = supabase
    .from(table)
    .select(selectClause);

  // Only apply tenant filtering if tenantId exists
  // Parents and other special cases might not require tenant filtering
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  // Apply additional filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  return query;
};

/**
 * 🚀 Enhanced CRUD operations with cached tenant ID
 */
export const tenantDatabase = {
  /**
   * Create record with automatic tenant_id (if available)
   */
  async create(table, data) {
    const tenantId = getCachedTenantId();
    
    // For parents and other special cases, tenant_id might not be required
    const dataWithTenant = tenantId ? { ...data, tenant_id: tenantId } : data;
    
    console.log(`✏️ Creating record in '${table}' with tenant_id: ${tenantId || 'NOT PROVIDED'}`);
    
    const { data: result, error } = await supabase
      .from(table)
      .insert(dataWithTenant)
      .select();

    // Return array format to match timetable code expectations
    // Convert single result to array if it's not already an array
    const normalizedResult = Array.isArray(result) ? result : (result ? [result] : []);
    return { data: normalizedResult, error };
  },

  /**
   * Create multiple records with automatic tenant_id (if available)
   */
  async createMany(table, dataArray) {
    const tenantId = getCachedTenantId();
    
    if (!Array.isArray(dataArray)) {
      throw new Error('createMany expects an array of data objects');
    }
    
    // Add tenant_id to each record if available
    const dataWithTenant = tenantId 
      ? dataArray.map(record => ({ ...record, tenant_id: tenantId }))
      : dataArray;
    
    console.log(`✏️ Creating ${dataArray.length} records in '${table}' with tenant_id: ${tenantId || 'NOT PROVIDED'}`);
    
    const { data: result, error } = await supabase
      .from(table)
      .insert(dataWithTenant)
      .select();

    return { data: result, error };
  },

  /**
   * Read records with automatic tenant filtering (if tenantId available)
   */
  async read(table, filters = {}, selectClause = '*') {
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      throw new Error('No tenant context for read operation');
    }
    
    const query = createTenantQuery(tenantId, table, selectClause, filters);
    
    console.log(`📖 Reading from '${table}' with tenant filter`);
    
    const { data, error } = await query;
    return { data, error };
  },

  /**
   * Read single record with tenant filtering (if tenantId available)
   */
  async readOne(table, id, selectClause = '*') {
    const tenantId = getCachedTenantId();
    
    console.log(`📖 Reading single record from '${table}' with tenant_id: ${tenantId || 'NOT REQUIRED'}`);
    
    let query = supabase
      .from(table)
      .select(selectClause)
      .eq('id', id);
    
    // Only apply tenant filtering if tenantId exists
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query.single();

    return { data, error };
  },

  /**
   * Update record with tenant validation (if tenantId available)
   * Supports both ID-based and filter-based updates
   */
  async update(table, idOrFilters, updates) {
    const tenantId = getCachedTenantId();
    
    console.log(`✏️ Updating record in '${table}' with tenant_id: ${tenantId || 'NOT REQUIRED'}`);
    
    let query = supabase
      .from(table)
      .update(updates);
    
    // Handle different types of identifiers
    if (typeof idOrFilters === 'string' || typeof idOrFilters === 'number') {
      // Simple ID-based update
      query = query.eq('id', idOrFilters);
    } else if (typeof idOrFilters === 'object' && idOrFilters !== null) {
      // Filter-based update
      Object.entries(idOrFilters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    } else {
      throw new Error('Invalid identifier: must be ID string/number or filters object');
    }
    
    // Only apply tenant filtering if tenantId exists
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }
    
    const { data: result, error } = await query.select();
    
    // Return array format to match timetable code expectations
    const normalizedResult = Array.isArray(result) ? result : (result ? [result] : []);
    return { data: normalizedResult, error };
  },

  /**
   * Delete record with tenant validation (if tenantId available)
   * Supports both ID-based and filter-based deletes
   */
  async delete(table, idOrFilters) {
    const tenantId = getCachedTenantId();
    
    console.log(`🗑️ Deleting record from '${table}' with tenant_id: ${tenantId || 'NOT REQUIRED'}`);
    
    let query = supabase
      .from(table)
      .delete();
    
    // Handle different types of identifiers
    if (typeof idOrFilters === 'string' || typeof idOrFilters === 'number') {
      // Simple ID-based delete
      query = query.eq('id', idOrFilters);
    } else if (typeof idOrFilters === 'object' && idOrFilters !== null) {
      // Filter-based delete
      Object.entries(idOrFilters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    } else {
      throw new Error('Invalid identifier: must be ID string/number or filters object');
    }
    
    // Only apply tenant filtering if tenantId exists
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    return { error };
  }
};

/**
 * 🚀 Initialize tenant helpers with context data
 * Call this when tenant context is ready
 */
export const initializeTenantHelpers = (tenantId) => {
  setCachedTenantId(tenantId);
  console.log('🚀 TenantHelpers: Initialized with tenant ID:', tenantId);
};

/**
 * 🚀 Reset tenant helpers (on logout)
 */
export const resetTenantHelpers = () => {
  clearCachedTenantId();
  console.log('🧹 TenantHelpers: Reset completed');
};

// Export legacy compatibility function
export const getCurrentTenantId = getCachedTenantId;

export default {
  useTenantAccess,
  getCachedTenantId,
  setCachedTenantId,
  clearCachedTenantId,
  createTenantQuery,
  tenantDatabase,
  initializeTenantHelpers,
  resetTenantHelpers
};