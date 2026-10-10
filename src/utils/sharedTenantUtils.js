/**
 * 🚀 SHARED TENANT UTILITIES
 * 
 * Common utilities shared between tenant context, helpers, and services
 * Created to break circular dependencies between tenant modules
 * 
 * This module contains:
 * - Tenant ID caching functionality
 * - Common validation utilities
 * - Shared constants and types
 */

/**
 * 🚀 Tenant ID caching with monitoring
 * Shared between tenantHelpers and enhanced services
 */
let _cachedTenantId = null;
let _tenantInitialized = false;
let _lastAccessTime = null;
let _accessCount = 0;

export const setCachedTenantId = (tenantId) => {
  if (!tenantId) {
    throw new Error('🚨 ENHANCED TENANT SYSTEM: Cannot set null or undefined tenant ID');
  }
  
  _cachedTenantId = tenantId;
  _tenantInitialized = true;
  _lastAccessTime = Date.now();
  _accessCount = 0;
};

export const getCachedTenantId = () => {
  _accessCount++;
  _lastAccessTime = Date.now();
  
  // 🚀 OPTIMIZED: Reduce noise by only warning if the app has had time to initialize
  if (!_tenantInitialized || !_cachedTenantId) {
    const appUptime = Date.now() - (_lastAccessTime || Date.now()); // Fallback for first access
    
    // Only warn if accessed multiple times or after a short grace period (3 seconds)
    // This avoids warnings during the normal rapid startup sequence
    if (_accessCount > 5 || appUptime > 3000) {
      // Warnings suppressed as per user request
    }
    return null;
  }
  
  return _cachedTenantId;
};

export const clearCachedTenantId = () => {
  console.log('🧹 Shared TenantUtils: Clearing tenant cache. Stats - Access Count:', _accessCount, 'Last Access:', new Date(_lastAccessTime || 0).toISOString());
  
  _cachedTenantId = null;
  _tenantInitialized = false;
  _lastAccessTime = null;
  _accessCount = 0;
};

export const getTenantCacheStats = () => {
  return {
    tenantId: _cachedTenantId,
    initialized: _tenantInitialized,
    accessCount: _accessCount,
    lastAccess: _lastAccessTime ? new Date(_lastAccessTime).toISOString() : null,
    isHealthy: _tenantInitialized && _cachedTenantId && _lastAccessTime
  };
};

/**
 * 🚀 Lifecycle management functions
 */
export const initializeTenantHelpers = (tenantId) => {
  setCachedTenantId(tenantId);
  // console.log('🚀 Shared TenantUtils: Initialized with tenant ID:', tenantId);
};

export const resetTenantHelpers = () => {
  clearCachedTenantId();
};

// Legacy compatibility
export const getCurrentTenantId = getCachedTenantId;

/**
 * 🚀 Common validation utilities
 */
export const validateTenantId = (tenantId, operation = 'database operation') => {
  if (!tenantId) {
    throw new Error(`🚨 ENHANCED TENANT SYSTEM: Tenant context required for ${operation}. Please ensure user is logged in and tenant is initialized.`);
  }
  return true;
};

/**
 * 🚀 Health monitoring
 */
export const getSharedTenantHealth = async () => {
  try {
    const cacheStats = getTenantCacheStats();
    const tenantAccess = _cachedTenantId ? { tenantId: _cachedTenantId, available: true } : { available: false };
    
    return {
      status: 'healthy',
      cache: cacheStats,
      tenant: tenantAccess,
      timestamp: new Date().toISOString(),
      version: '2.0.0-shared'
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      version: '2.0.0-shared'
    };
  }
};

/**
 * 🚀 Export all utilities as default for convenience
 */
export default {
  // Core tenant access
  getCachedTenantId,
  setCachedTenantId,
  clearCachedTenantId,
  getTenantCacheStats,
  
  // Lifecycle management
  initializeTenantHelpers,
  resetTenantHelpers,
  
  // Validation
  validateTenantId,
  
  // Health monitoring
  getSharedTenantHealth,
  
  // Legacy compatibility
  getCurrentTenantId
};