// Teacher Dashboard Debug Script
// Run this in browser console to debug teacher dashboard issues

console.log('🔍 TEACHER DASHBOARD DEBUG TOOL');
console.log('================================');

// Function to check authentication state
function checkAuthState() {
  console.log('\n📱 AUTHENTICATION CHECK');
  console.log('------------------------');
  
  // Try to find React DevTools if available
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools detected');
  } else {
    console.log('⚠️ React DevTools not available');
  }
  
  // Check localStorage for any auth tokens
  const authKeys = Object.keys(localStorage).filter(key => 
    key.includes('auth') || key.includes('user') || key.includes('token') || key.includes('supabase')
  );
  
  console.log('🔑 Auth-related localStorage keys:', authKeys);
  
  // Check if user is logged in by looking for common patterns
  const hasAuthData = authKeys.length > 0;
  console.log('👤 Authentication status:', hasAuthData ? '✅ Likely authenticated' : '❌ No auth data found');
  
  return { hasAuthData, authKeys };
}

// Function to check network requests
function monitorNetworkRequests() {
  console.log('\n🌐 NETWORK MONITORING');
  console.log('---------------------');
  
  // Override fetch to monitor requests
  const originalFetch = window.fetch;
  let requestCount = 0;
  let failedRequests = [];
  
  window.fetch = function(...args) {
    requestCount++;
    const url = args[0];
    const startTime = Date.now();
    
    console.log(`📡 Request #${requestCount}: ${url}`);
    
    return originalFetch.apply(this, args)
      .then(response => {
        const duration = Date.now() - startTime;
        if (!response.ok) {
          console.log(`❌ Request failed: ${url} (${response.status}) - ${duration}ms`);
          failedRequests.push({ url, status: response.status, duration });
        } else {
          console.log(`✅ Request success: ${url} (${response.status}) - ${duration}ms`);
        }
        return response;
      })
      .catch(error => {
        const duration = Date.now() - startTime;
        console.log(`💥 Request error: ${url} - ${error.message} - ${duration}ms`);
        failedRequests.push({ url, error: error.message, duration });
        throw error;
      });
  };
  
  // Restore original fetch after 30 seconds
  setTimeout(() => {
    window.fetch = originalFetch;
    console.log('🔄 Network monitoring stopped');
    console.log('📊 Failed requests:', failedRequests);
  }, 30000);
  
  console.log('🔄 Network monitoring started (will stop in 30s)');
}

// Function to check for React errors
function monitorReactErrors() {
  console.log('\n⚛️ REACT ERROR MONITORING');
  console.log('-------------------------');
  
  // Listen for unhandled errors
  window.addEventListener('error', (event) => {
    console.log('💥 JavaScript Error:', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error
    });
  });
  
  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.log('💥 Unhandled Promise Rejection:', {
      reason: event.reason,
      promise: event.promise
    });
  });
  
  console.log('✅ React error monitoring enabled');
}

// Function to check database connection
async function testDatabaseConnection() {
  console.log('\n🗄️ DATABASE CONNECTION TEST');
  console.log('----------------------------');
  
  try {
    // Try to find Supabase client in window object
    const supabaseClient = window.supabase || 
                          window._supabase || 
                          (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED);
    
    if (supabaseClient) {
      console.log('✅ Supabase client found');
      
      // Try a simple test query
      try {
        console.log('🔄 Testing database connection...');
        // This is a hypothetical test - actual implementation would depend on available methods
        console.log('⚠️ Cannot test database directly from console without proper client reference');
      } catch (dbError) {
        console.log('❌ Database test error:', dbError.message);
      }
    } else {
      console.log('❌ Supabase client not found in window object');
    }
  } catch (error) {
    console.log('💥 Database connection test failed:', error.message);
  }
}

// Function to check for common teacher dashboard issues
function checkTeacherDashboardIssues() {
  console.log('\n👨‍🏫 TEACHER DASHBOARD SPECIFIC CHECKS');
  console.log('-------------------------------------');
  
  // Check if teacher dashboard elements exist
  const dashboardElements = {
    'Welcome Section': document.querySelector('[data-testid="welcome-section"]') || document.querySelector('.welcomeSection'),
    'Stats Cards': document.querySelector('[data-testid="stats-section"]') || document.querySelector('.statsSection'),
    'Quick Actions': document.querySelector('[data-testid="quick-actions"]') || document.querySelector('.quickActionsGrid'),
    'Schedule': document.querySelector('[data-testid="schedule"]') || document.querySelector('.scheduleItem'),
    'Tasks': document.querySelector('[data-testid="tasks"]') || document.querySelector('.tasksContainer')
  };
  
  Object.entries(dashboardElements).forEach(([name, element]) => {
    console.log(`${element ? '✅' : '❌'} ${name}: ${element ? 'Found' : 'Not found'}`);
  });
  
  // Check for loading indicators
  const loadingElements = document.querySelectorAll('[data-testid*="loading"], .loading, .spinner, .skeleton');
  console.log(`🔄 Loading indicators found: ${loadingElements.length}`);
  
  // Check for error messages
  const errorElements = document.querySelectorAll('[data-testid*="error"], .error, .error-message');
  console.log(`❌ Error elements found: ${errorElements.length}`);
  
  if (errorElements.length > 0) {
    errorElements.forEach((el, index) => {
      console.log(`Error ${index + 1}:`, el.textContent);
    });
  }
}

// Function to check console logs for teacher dashboard
function filterTeacherDashboardLogs() {
  console.log('\n📋 TEACHER DASHBOARD LOG ANALYSIS');
  console.log('---------------------------------');
  
  // Override console methods to capture logs
  const logs = [];
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.log = function(...args) {
    const message = args.join(' ');
    if (message.includes('Teacher') || message.includes('dashboard') || message.includes('[AUTH]')) {
      logs.push({ type: 'log', message, timestamp: new Date().toISOString() });
    }
    return originalLog.apply(console, args);
  };
  
  console.error = function(...args) {
    const message = args.join(' ');
    logs.push({ type: 'error', message, timestamp: new Date().toISOString() });
    return originalError.apply(console, args);
  };
  
  console.warn = function(...args) {
    const message = args.join(' ');
    logs.push({ type: 'warn', message, timestamp: new Date().toISOString() });
    return originalWarn.apply(console, args);
  };
  
  // Restore after 60 seconds and show captured logs
  setTimeout(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    
    console.log('\n📊 CAPTURED LOGS (last 60 seconds):');
    logs.forEach(log => {
      console.log(`[${log.type.toUpperCase()}] ${log.message}`);
    });
  }, 60000);
  
  console.log('🔄 Log capture started (will stop in 60s)');
}

// Main debug function
function debugTeacherDashboard() {
  console.log('🚀 Starting comprehensive Teacher Dashboard debug...\n');
  
  // Run all checks
  checkAuthState();
  monitorNetworkRequests();
  monitorReactErrors();
  testDatabaseConnection();
  checkTeacherDashboardIssues();
  filterTeacherDashboardLogs();
  
  console.log('\n✅ Debug monitoring is now active!');
  console.log('📝 Check the console for ongoing updates');
  console.log('🔄 Refresh the page or navigate to Teacher Dashboard to see detailed logs');
  
  // Set up periodic checks
  const intervalId = setInterval(() => {
    checkTeacherDashboardIssues();
  }, 10000); // Check every 10 seconds
  
  // Stop periodic checks after 5 minutes
  setTimeout(() => {
    clearInterval(intervalId);
    console.log('🛑 Periodic checks stopped after 5 minutes');
  }, 300000);
  
  return {
    stop: () => {
      clearInterval(intervalId);
      console.log('🛑 Manual debug stop requested');
    }
  };
}

// Auto-run the debug
window.teacherDashboardDebug = debugTeacherDashboard();

console.log('\n🎯 QUICK ACTIONS:');
console.log('- Run: teacherDashboardDebug.stop() to stop monitoring');
console.log('- Run: checkTeacherDashboardIssues() for instant check');
console.log('- Run: checkAuthState() to verify authentication');
