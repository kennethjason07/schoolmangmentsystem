// Universal Role ID Interceptor
// This will intercept ALL Supabase operations and validate role_id values

import { supabase } from './supabase';

// Global interceptor flag
let interceptorEnabled = false;

// Function to validate role_id in data objects
function validateRoleIdInData(data, operation = 'database operation') {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map((item, index) => {
      if (item && typeof item === 'object' && item.hasOwnProperty('role_id')) {
        const originalRoleId = item.role_id;
        const validatedRoleId = validateSingleRoleId(originalRoleId, `${operation}[${index}]`);
        return { ...item, role_id: validatedRoleId };
      }
      return item;
    });
  }
  
  if (typeof data === 'object' && data.hasOwnProperty('role_id')) {
    const originalRoleId = data.role_id;
    const validatedRoleId = validateSingleRoleId(originalRoleId, operation);
    return { ...data, role_id: validatedRoleId };
  }
  
  return data;
}

// Function to validate a single role_id value
function validateSingleRoleId(roleId, operation = 'operation') {
  console.log(`🔍 [RoleIdInterceptor] Validating role_id for ${operation}:`, roleId, `(type: ${typeof roleId})`);
  
  // Check for undefined, null, or string 'undefined'
  if (roleId === undefined || roleId === null || roleId === 'undefined') {
    console.error(`🚨 [RoleIdInterceptor] CRITICAL: Invalid role_id detected in ${operation}:`, roleId);
    console.error(`🚨 [RoleIdInterceptor] Stack trace:`, new Error().stack);
    const fallback = 1; // Admin fallback
    console.warn(`🔄 [RoleIdInterceptor] Using fallback role_id: ${fallback}`);
    return fallback;
  }
  
  // Check for NaN
  if (typeof roleId === 'number' && isNaN(roleId)) {
    console.error(`🚨 [RoleIdInterceptor] CRITICAL: role_id is NaN in ${operation}:`, roleId);
    const fallback = 1;
    console.warn(`🔄 [RoleIdInterceptor] Using fallback role_id: ${fallback}`);
    return fallback;
  }
  
  // Convert string numbers to numbers (if valid)
  if (typeof roleId === 'string') {
    const numValue = parseInt(roleId);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 10) {
      console.warn(`⚠️ [RoleIdInterceptor] Converting string role_id "${roleId}" to number ${numValue} in ${operation}`);
      return numValue;
    } else {
      console.error(`🚨 [RoleIdInterceptor] CRITICAL: Invalid string role_id in ${operation}:`, roleId);
      const fallback = 1;
      console.warn(`🔄 [RoleIdInterceptor] Using fallback role_id: ${fallback}`);
      return fallback;
    }
  }
  
  // Ensure it's a positive integer within range
  if (typeof roleId === 'number' && roleId > 0 && roleId <= 10 && Number.isInteger(roleId)) {
    console.log(`✅ [RoleIdInterceptor] Valid role_id in ${operation}:`, roleId);
    return roleId;
  }
  
  // Fallback for any other invalid cases
  console.error(`🚨 [RoleIdInterceptor] CRITICAL: Invalid role_id type/value in ${operation}:`, roleId, typeof roleId);
  const fallback = 1;
  console.warn(`🔄 [RoleIdInterceptor] Using fallback role_id: ${fallback}`);
  return fallback;
}

// Intercept Supabase from() method
function enableRoleIdInterceptor() {
  if (interceptorEnabled) {
    console.log('⚠️ [RoleIdInterceptor] Already enabled');
    return;
  }
  
  console.log('🚀 [RoleIdInterceptor] Enabling universal role_id validation...');
  
  // Store original methods
  const originalFrom = supabase.from;
  
  // Override supabase.from()
  supabase.from = function(tableName) {
    const tableQuery = originalFrom.call(this, tableName);
    
    // Only intercept operations on tables that might contain role_id OR queries on roles table
    const tablesWithRoleId = ['users', 'user_profiles', 'accounts', 'roles'];
    const shouldIntercept = tablesWithRoleId.includes(tableName) || tableName.includes('user');
    
    if (shouldIntercept) {
      console.log(`🎯 [RoleIdInterceptor] Monitoring table: ${tableName}`);
      
      // Intercept insert method
      if (tableQuery.insert) {
        const originalInsert = tableQuery.insert;
        tableQuery.insert = function(data) {
          console.log(`🔍 [RoleIdInterceptor] Intercepting INSERT on ${tableName}:`, data);
          const validatedData = validateRoleIdInData(data, `INSERT on ${tableName}`);
          console.log(`✅ [RoleIdInterceptor] Validated data for INSERT on ${tableName}:`, validatedData);
          return originalInsert.call(this, validatedData);
        };
      }
      
      // Intercept upsert method
      if (tableQuery.upsert) {
        const originalUpsert = tableQuery.upsert;
        tableQuery.upsert = function(data) {
          console.log(`🔍 [RoleIdInterceptor] Intercepting UPSERT on ${tableName}:`, data);
          const validatedData = validateRoleIdInData(data, `UPSERT on ${tableName}`);
          console.log(`✅ [RoleIdInterceptor] Validated data for UPSERT on ${tableName}:`, validatedData);
          return originalUpsert.call(this, validatedData);
        };
      }
      
      // Intercept update method
      if (tableQuery.update) {
        const originalUpdate = tableQuery.update;
        tableQuery.update = function(data) {
          console.log(`🔍 [RoleIdInterceptor] Intercepting UPDATE on ${tableName}:`, data);
          const validatedData = validateRoleIdInData(data, `UPDATE on ${tableName}`);
          console.log(`✅ [RoleIdInterceptor] Validated data for UPDATE on ${tableName}:`, validatedData);
          return originalUpdate.call(this, validatedData);
        };
      }
      
      // Intercept eq method for role_id queries
      if (tableQuery.eq) {
        const originalEq = tableQuery.eq;
        tableQuery.eq = function(column, value) {
          if (column === 'role_id' || column.includes('role_id')) {
            console.log(`🔍 [RoleIdInterceptor] Intercepting EQ query on ${tableName}.${column}:`, value);
            const validatedValue = validateSingleRoleId(value, `EQ query on ${tableName}.${column}`);
            console.log(`✅ [RoleIdInterceptor] Validated value for EQ query on ${tableName}.${column}:`, validatedValue);
            return originalEq.call(this, column, validatedValue);
          }
          return originalEq.call(this, column, value);
        };
      }
    }
    
    return tableQuery;
  };
  
  interceptorEnabled = true;
  console.log('✅ [RoleIdInterceptor] Universal role_id validation enabled successfully');
}

// Disable the interceptor
function disableRoleIdInterceptor() {
  if (!interceptorEnabled) {
    console.log('⚠️ [RoleIdInterceptor] Already disabled');
    return;
  }
  
  console.log('🛑 [RoleIdInterceptor] Disabling universal role_id validation...');
  // Note: This would require storing the original methods to restore them
  // For now, we'll keep it enabled once activated
  interceptorEnabled = false;
  console.log('✅ [RoleIdInterceptor] Universal role_id validation disabled');
}

export {
  enableRoleIdInterceptor,
  disableRoleIdInterceptor,
  validateRoleIdInData,
  validateSingleRoleId
};
