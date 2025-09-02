// Comprehensive Role ID Validation Fix
// Apply this patch to prevent any undefined role_id from reaching the database

// 1. Enhanced role_id validation function
function validateRoleIdForDatabase(data, operation = 'database insert') {
  console.log(`🔍 Validating role_id for ${operation}:`, data);
  
  if (Array.isArray(data)) {
    // Handle array of objects
    return data.map((item, index) => {
      if (item.hasOwnProperty('role_id')) {
        const originalRoleId = item.role_id;
        const safeRoleId = ensureSafeRoleId(originalRoleId);
        
        if (originalRoleId !== safeRoleId) {
          console.warn(`⚠️ [${operation}] Item ${index}: role_id corrected from ${JSON.stringify(originalRoleId)} to ${safeRoleId}`);
        }
        
        return { ...item, role_id: safeRoleId };
      }
      return item;
    });
  } else if (data && typeof data === 'object' && data.hasOwnProperty('role_id')) {
    // Handle single object
    const originalRoleId = data.role_id;
    const safeRoleId = ensureSafeRoleId(originalRoleId);
    
    if (originalRoleId !== safeRoleId) {
      console.warn(`⚠️ [${operation}] role_id corrected from ${JSON.stringify(originalRoleId)} to ${safeRoleId}`);
    }
    
    return { ...data, role_id: safeRoleId };
  }
  
  return data;
}

// 2. Safe role ID function
function ensureSafeRoleId(roleId) {
  // Log the input for debugging
  console.log(`🔧 ensureSafeRoleId input:`, roleId, `(type: ${typeof roleId})`);
  
  // If it's already a valid number, return it
  if (typeof roleId === 'number' && !isNaN(roleId) && roleId > 0) {
    return roleId;
  }
  
  // If it's a valid string number, convert it
  if (typeof roleId === 'string' && !isNaN(Number(roleId)) && Number(roleId) > 0) {
    return Number(roleId);
  }
  
  // For any invalid input, return admin role (1) as fallback
  console.warn(`🚨 Invalid role_id detected: ${JSON.stringify(roleId)}, using fallback admin role (1)`);
  return 1; // Default to admin
}

// 3. Patch AuthContext signup to add extra validation
const authContextPatch = `
// Add this to AuthContext.js after line 514 (before creating newUserData):

// COMPREHENSIVE ROLE_ID VALIDATION - Additional safety check
const originalRoleId = userData.role_id;
console.log('🔍 [AuthContext] Original role_id from userData:', originalRoleId, typeof originalRoleId);

// First validation (existing code)
const safeRoleId = typeof userData.role_id === 'number' && !isNaN(userData.role_id) ? userData.role_id : 1;

// Additional validation - ensure it's never undefined, null, or 'undefined' string
let finalRoleId = safeRoleId;
if (finalRoleId === undefined || finalRoleId === null || finalRoleId === 'undefined' || finalRoleId === NaN) {
  console.error('🚨 [AuthContext] Critical: role_id is still invalid after first validation:', finalRoleId);
  finalRoleId = 1; // Force admin fallback
}

// Ensure it's a positive integer
if (typeof finalRoleId !== 'number' || finalRoleId <= 0 || !Number.isInteger(finalRoleId)) {
  console.error('🚨 [AuthContext] Critical: role_id is not a positive integer:', finalRoleId);
  finalRoleId = 1; // Force admin fallback
}

console.log('✅ [AuthContext] Final validated role_id:', finalRoleId);

// Use finalRoleId instead of safeRoleId in newUserData
`;

// 4. Patch dbHelpers account creation functions
const dbHelpersPatch = `
// Add this validation to createStudentAccount, createTeacherAccount, and createParentAccount
// Before any database insertion:

// COMPREHENSIVE ROLE_ID VALIDATION
const roleIdValidation = (roleId, accountType) => {
  console.log(\`🔍 [dbHelpers] Validating \${accountType} role_id:\`, roleId, typeof roleId);
  
  if (roleId === undefined || roleId === null || roleId === 'undefined') {
    console.error(\`🚨 [dbHelpers] CRITICAL: \${accountType} role_id is undefined/null/string-undefined:\`, roleId);
    throw new Error(\`Invalid \${accountType} role ID - cannot be undefined, null, or 'undefined'\`);
  }
  
  if (typeof roleId !== 'number' || isNaN(roleId) || roleId <= 0) {
    console.error(\`🚨 [dbHelpers] CRITICAL: \${accountType} role_id is not a valid positive number:\`, roleId, typeof roleId);
    throw new Error(\`Invalid \${accountType} role ID - must be a positive number, got: \${typeof roleId}\`);
  }
  
  console.log(\`✅ [dbHelpers] \${accountType} role_id validation passed:\`, roleId);
  return roleId;
};

// Then before the database insert, add:
const validatedRoleId = roleIdValidation(teacherRoleId, 'teacher'); // or studentRoleId/parentRoleId
// Use validatedRoleId in the insert instead of the original value
`;

// 5. Universal Supabase insert wrapper
const supabaseInsertWrapper = `
// Add this wrapper to intercept all Supabase inserts
const originalSupabaseInsert = supabase.from;

supabase.from = function(tableName) {
  const tableQuery = originalSupabaseInsert.call(this, tableName);
  
  if (tableName === 'users') {
    const originalInsert = tableQuery.insert;
    const originalUpsert = tableQuery.upsert;
    
    // Wrap insert method
    tableQuery.insert = function(data) {
      console.log('🔍 [Supabase] Intercepting users table insert:', data);
      const validatedData = validateRoleIdForDatabase(data, 'users insert');
      console.log('✅ [Supabase] Validated data for users insert:', validatedData);
      return originalInsert.call(this, validatedData);
    };
    
    // Wrap upsert method
    tableQuery.upsert = function(data) {
      console.log('🔍 [Supabase] Intercepting users table upsert:', data);
      const validatedData = validateRoleIdForDatabase(data, 'users upsert');
      console.log('✅ [Supabase] Validated data for users upsert:', validatedData);
      return originalUpsert.call(this, validatedData);
    };
  }
  
  return tableQuery;
};
`;

// 6. Emergency role_id fix for existing problematic data
const emergencyDataFix = `
-- SQL to fix any existing problematic role_id values in the database
-- Run this in your Supabase SQL editor if there are already bad records

-- Check for problematic role_id values
SELECT id, email, role_id, full_name 
FROM users 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10;

-- Fix NULL or invalid role_id values (set to admin = 1)
UPDATE users 
SET role_id = 1 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10;

-- Verify the fix
SELECT id, email, role_id, full_name 
FROM users 
WHERE role_id IS NULL 
   OR role_id < 1 
   OR role_id > 10;
`;

console.log('📋 COMPREHENSIVE ROLE_ID VALIDATION FIX');
console.log('=====================================');
console.log('');
console.log('🔧 Apply these patches to prevent undefined role_id errors:');
console.log('');
console.log('1. AuthContext.js patch:');
console.log(authContextPatch);
console.log('');
console.log('2. dbHelpers (supabase.js) patch:');
console.log(dbHelpersPatch);
console.log('');
console.log('3. Universal Supabase wrapper:');
console.log(supabaseInsertWrapper);
console.log('');
console.log('4. Emergency SQL fix:');
console.log(emergencyDataFix);
console.log('');
console.log('💡 Additional debugging:');
console.log('- Add the monitor_inserts.js script to track all database inserts');
console.log('- Test account creation with debug logging enabled');
console.log('- Check browser network tab for any undefined values in POST requests');

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateRoleIdForDatabase,
    ensureSafeRoleId,
    authContextPatch,
    dbHelpersPatch,
    supabaseInsertWrapper,
    emergencyDataFix
  };
}
