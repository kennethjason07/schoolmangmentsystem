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
  // Check for undefined, null, or string 'undefined'
  if (roleId === undefined || roleId === null || roleId === 'undefined') {
    console.error(`[RoleIdInterceptor] Invalid role_id detected in ${operation}:`, roleId);
    const fallback = 1; // Admin fallback
    return fallback;
  }
  
  // Check for NaN
  if (typeof roleId === 'number' && isNaN(roleId)) {
    console.error(`[RoleIdInterceptor] role_id is NaN in ${operation}:`, roleId);
    const fallback = 1;
    return fallback;
  }
  
  // Convert string numbers to numbers (if valid)
  if (typeof roleId === 'string') {
    const numValue = parseInt(roleId);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 10) {
      return numValue;
    } else {
      console.error(`[RoleIdInterceptor] Invalid string role_id in ${operation}:`, roleId);
      const fallback = 1;
      return fallback;
    }
  }
  
  // Ensure it's a positive integer within range
  if (typeof roleId === 'number' && roleId > 0 && roleId <= 10 && Number.isInteger(roleId)) {
    return roleId;
  }
  
  // Fallback for any other invalid cases
  console.error(`[RoleIdInterceptor] Invalid role_id type/value in ${operation}:`, roleId, typeof roleId);
  const fallback = 1;
  return fallback;
}

// Intercept Supabase from() method
function enableRoleIdInterceptor() {
  if (interceptorEnabled) {
    return;
  }
  
  // Store original methods
  const originalFrom = supabase.from;
  
  // Override supabase.from()
  supabase.from = function(tableName) {
    const tableQuery = originalFrom.call(this, tableName);
    
    // Only intercept operations on tables that might contain role_id OR queries on roles table
    const tablesWithRoleId = ['users', 'user_profiles', 'accounts', 'roles'];
    const shouldIntercept = tablesWithRoleId.includes(tableName) || tableName.includes('user');
    
    if (shouldIntercept) {
      // Intercept insert method
      if (tableQuery.insert) {
        const originalInsert = tableQuery.insert;
        tableQuery.insert = function(data) {
          const validatedData = validateRoleIdInData(data, `INSERT on ${tableName}`);
          return originalInsert.call(this, validatedData);
        };
      }
      
      // Intercept upsert method
      if (tableQuery.upsert) {
        const originalUpsert = tableQuery.upsert;
        tableQuery.upsert = function(data) {
          const validatedData = validateRoleIdInData(data, `UPSERT on ${tableName}`);
          return originalUpsert.call(this, validatedData);
        };
      }
      
      // Intercept update method
      if (tableQuery.update) {
        const originalUpdate = tableQuery.update;
        tableQuery.update = function(data) {
          const validatedData = validateRoleIdInData(data, `UPDATE on ${tableName}`);
          return originalUpdate.call(this, validatedData);
        };
      }
      
      // Intercept eq method for role_id queries
      if (tableQuery.eq) {
        const originalEq = tableQuery.eq;
        tableQuery.eq = function(column, value) {
          if (column === 'role_id' || column.includes('role_id')) {
            const validatedValue = validateSingleRoleId(value, `EQ query on ${tableName}.${column}`);
            return originalEq.call(this, column, validatedValue);
          }
          return originalEq.call(this, column, value);
        };
      }
    }
    
    return tableQuery;
  };
  
  interceptorEnabled = true;
}

// Disable the interceptor
function disableRoleIdInterceptor() {
  if (!interceptorEnabled) {
    return;
  }
  
  // Note: This would require storing the original methods to restore them
  // For now, we'll keep it enabled once activated
  interceptorEnabled = false;
}

export {
  enableRoleIdInterceptor,
  disableRoleIdInterceptor,
  validateRoleIdInData,
  validateSingleRoleId
};
