// Database Insert Monitor - Add this to your main app entry point to track all inserts

// Monkey patch all potential insert operations to log role_id values
function monitorSupabaseInserts() {
  console.log('🔍 Database insert monitoring enabled - tracking all role_id values');
  
  // Create a global counter for insert operations
  window.insertCounter = 0;
  
  // Function to validate and log role_id
  function logRoleIdInsert(operation, tableName, data, stackTrace) {
    const insertId = ++window.insertCounter;
    
    console.group(`🔍 INSERT MONITOR #${insertId}: ${operation} on ${tableName}`);
    console.log('📊 Data being inserted:', data);
    
    if (Array.isArray(data)) {
      // Handle array of objects
      data.forEach((item, index) => {
        if (item.hasOwnProperty('role_id')) {
          const roleId = item.role_id;
          console.log(`  🎯 Item ${index} role_id:`, roleId, `(type: ${typeof roleId})`);
          
          if (roleId === undefined || roleId === null || roleId === 'undefined') {
            console.error(`  🚨 CRITICAL: Invalid role_id detected in item ${index}!`);
            console.error(`  📍 Stack trace:`, stackTrace);
            console.error(`  📦 Full item data:`, JSON.stringify(item, null, 2));
            
            // Optionally throw an error to stop execution
            // throw new Error(`Invalid role_id detected: ${roleId}`);
          }
        }
      });
    } else if (data && typeof data === 'object') {
      // Handle single object
      if (data.hasOwnProperty('role_id')) {
        const roleId = data.role_id;
        console.log(`  🎯 role_id:`, roleId, `(type: ${typeof roleId})`);
        
        if (roleId === undefined || roleId === null || roleId === 'undefined') {
          console.error(`  🚨 CRITICAL: Invalid role_id detected!`);
          console.error(`  📍 Stack trace:`, stackTrace);
          console.error(`  📦 Full data object:`, JSON.stringify(data, null, 2));
          
          // Optionally throw an error to stop execution
          // throw new Error(`Invalid role_id detected: ${roleId}`);
        }
      }
    }
    
    console.groupEnd();
  }
  
  // Get current stack trace
  function getStackTrace() {
    const stack = new Error().stack;
    return stack ? stack.split('\n').slice(2, 8).join('\n') : 'Stack trace not available';
  }
  
  // Monitor direct Supabase client inserts (if supabase is available globally)
  if (typeof supabase !== 'undefined' && supabase.from) {
    console.log('🔍 Monitoring Supabase client directly');
    
    const originalFrom = supabase.from;
    supabase.from = function(tableName) {
      const tableQuery = originalFrom.call(this, tableName);
      
      // Monitor insert method
      if (tableQuery.insert) {
        const originalInsert = tableQuery.insert;
        tableQuery.insert = function(data) {
          const stack = getStackTrace();
          logRoleIdInsert('supabase.from().insert()', tableName, data, stack);
          return originalInsert.call(this, data);
        };
      }
      
      // Monitor upsert method  
      if (tableQuery.upsert) {
        const originalUpsert = tableQuery.upsert;
        tableQuery.upsert = function(data) {
          const stack = getStackTrace();
          logRoleIdInsert('supabase.from().upsert()', tableName, data, stack);
          return originalUpsert.call(this, data);
        };
      }
      
      return tableQuery;
    };
  }
  
  // Monitor fetch/XHR requests for database operations
  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function(...args) {
      const url = args[0];
      const options = args[1] || {};
      
      // Check if this is a Supabase API request
      if (url && url.includes && (url.includes('supabase.co') || url.includes('users'))) {
        const method = options.method || 'GET';
        
        if (method === 'POST' && options.body) {
          try {
            const bodyData = JSON.parse(options.body);
            if (bodyData && bodyData.role_id) {
              const stack = getStackTrace();
              logRoleIdInsert(`fetch ${method}`, url, bodyData, stack);
            }
          } catch (e) {
            // Body might not be JSON
          }
        }
      }
      
      return originalFetch.apply(this, args);
    };
  }
  
  // Monitor XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method;
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(data) {
    if (this._method === 'POST' && this._url && this._url.includes && 
        (this._url.includes('supabase.co') || this._url.includes('users')) && data) {
      try {
        const bodyData = JSON.parse(data);
        if (bodyData && bodyData.role_id) {
          const stack = getStackTrace();
          logRoleIdInsert(`XHR ${this._method}`, this._url, bodyData, stack);
        }
      } catch (e) {
        // Body might not be JSON
      }
    }
    
    return originalXHRSend.apply(this, [data]);
  };
}

// Console instructions for manual activation
console.log(`
🔧 To activate database insert monitoring, run this in your browser console:

// Copy and paste the entire function above, then run:
monitorSupabaseInserts();

This will monitor all database inserts and log any role_id values being inserted.
Look for 🚨 CRITICAL messages that indicate undefined role_id values.
`);

// Export for use in React Native or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { monitorSupabaseInserts };
}

// Auto-activate in browser if available
if (typeof window !== 'undefined') {
  // Wait for app to load then activate
  setTimeout(() => {
    if (typeof window.supabase !== 'undefined') {
      monitorSupabaseInserts();
    } else {
      console.log('⚠️ Supabase not found on window, manual activation required');
    }
  }, 1000);
}
