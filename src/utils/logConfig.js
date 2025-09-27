import { auth, error, warn } from './logger';

/**
 * Quick Log Configuration
 * 
 * Set any category to false to silence those logs immediately
 * This works by overriding console.log, console.error, console.warn
 */

// Configuration - Set to false to silence specific log types
const LOG_FILTERS = {
  // Authentication and user-related logs
  AUTH_LOGS: false,           // 🔐, 👤, 📧, 🎯, 🏷️
  
  // Tenant and initialization logs  
  TENANT_LOGS: false,         // 🏢, 🚀 TenantProvider, TenantContext
  
  // API and data fetching logs
  API_LOGS: false,            // 🔄, 📱, 📊, fetching, query
  
  // Component lifecycle logs
  COMPONENT_LOGS: false,      // 🧩, 🏗️, component, render
  
  // Real-time and subscription logs
  REALTIME_LOGS: false,       // ⚡, 💬, subscription, real-time
  
  // Navigation and routing logs
  NAVIGATION_LOGS: false,     // 🎯 AppNavigator, navigation
  
  // Chat and messaging logs
  CHAT_LOGS: false,           // 💬 ChatBadge, message
  
  // Student context logs
  STUDENT_CONTEXT_LOGS: false, // SelectedStudentContext
  
  // Network and connectivity logs
  NETWORK_LOGS: false,        // Network Diagnostics, connectivity
  
  // General info logs
  INFO_LOGS: true,            // General information
  
  // Error logs (recommended to keep these on)
  ERROR_LOGS: true,           // ❌, console.error
  
  // Success logs
  SUCCESS_LOGS: true,         // ✅
  
  // Warning logs
  WARNING_LOGS: true          // ⚠️, console.warn
};

// Master switch - set to false to disable ALL logs
const ENABLE_LOGGING = true;

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

/**
 * Check if a log message should be filtered out
 */
function shouldFilterLog(message) {
  if (!ENABLE_LOGGING) return true;
  
  const msgStr = typeof message === 'string' ? message : String(message);
  
  // Authentication logs
  if (!LOG_FILTERS.AUTH_LOGS && (
    msgStr.includes('🔐') || msgStr.includes('👤') || msgStr.includes('📧') ||
    msgStr.includes('🎯') || msgStr.includes('🏷️') ||
    msgStr.includes('[AUTH]') || msgStr.includes('auth') ||
    msgStr.includes('login') || msgStr.includes('user') ||
    msgStr.includes('CURRENT USER') || msgStr.includes('User profile')
  )) {
    return true;
  }
  
  // Tenant logs
  if (!LOG_FILTERS.TENANT_LOGS && (
    msgStr.includes('🏢') || msgStr.includes('🚀 TenantProvider') ||
    msgStr.includes('🚀 TenantContext') || msgStr.includes('TenantProvider') ||
    msgStr.includes('TenantContext') || msgStr.includes('tenant') ||
    msgStr.includes('Enhanced TenantHelpers')
  )) {
    return true;
  }
  
  // API logs
  if (!LOG_FILTERS.API_LOGS && (
    msgStr.includes('🔄') || msgStr.includes('📱') || msgStr.includes('📊') ||
    msgStr.includes('[API]') || msgStr.includes('fetching') ||
    msgStr.includes('query') || msgStr.includes('Supabase')
  )) {
    return true;
  }
  
  // Component logs
  if (!LOG_FILTERS.COMPONENT_LOGS && (
    msgStr.includes('🧩') || msgStr.includes('🏗️') ||
    msgStr.includes('[COMPONENT]') || msgStr.includes('component') ||
    msgStr.includes('render') || msgStr.includes('Component initialized')
  )) {
    return true;
  }
  
  // Real-time logs
  if (!LOG_FILTERS.REALTIME_LOGS && (
    msgStr.includes('⚡') || msgStr.includes('💬') ||
    msgStr.includes('[REALTIME]') || msgStr.includes('subscription') ||
    msgStr.includes('real-time') || msgStr.includes('ChatBadge') ||
    msgStr.includes('UniversalNotificationService')
  )) {
    return true;
  }
  
  // Navigation logs
  if (!LOG_FILTERS.NAVIGATION_LOGS && (
    msgStr.includes('🎯 AppNavigator') || msgStr.includes('navigation') ||
    msgStr.includes('AppNavigator')
  )) {
    return true;
  }
  
  // Chat logs
  if (!LOG_FILTERS.CHAT_LOGS && (
    msgStr.includes('💬 [ChatBadge') || msgStr.includes('Message count')
  )) {
    return true;
  }
  
  // Student context logs
  if (!LOG_FILTERS.STUDENT_CONTEXT_LOGS && (
    msgStr.includes('SelectedStudentContext') || msgStr.includes('available students')
  )) {
    return true;
  }
  
  // Network logs
  if (!LOG_FILTERS.NETWORK_LOGS && (
    msgStr.includes('Network Diagnostics') || msgStr.includes('connectivity') ||
    msgStr.includes('Supabase connection') || msgStr.includes('Token refreshed')
  )) {
    return true;
  }
  
  // Info logs
  if (!LOG_FILTERS.INFO_LOGS && (
    msgStr.includes('ℹ️') || msgStr.includes('[INFO]')
  )) {
    return true;
  }
  
  return false;
}

/**
 * Override console methods with filtering
 */
function initializeLogFiltering() {
  console.log = function(...args) {
    const firstArg = args[0];
    if (!shouldFilterLog(firstArg)) {
      originalConsole.log.apply(console, args);
    }
  };
  
  console.error = function(...args) {
    const firstArg = args[0];
    if (LOG_FILTERS.ERROR_LOGS && !shouldFilterLog(firstArg)) {
      originalConsole.error.apply(console, args);
    }
  };
  
  console.warn = function(...args) {
    const firstArg = args[0];
    if (LOG_FILTERS.WARNING_LOGS && !shouldFilterLog(firstArg)) {
      originalConsole.warn.apply(console, args);
    }
  };
}

/**
 * Restore original console methods
 */
function restoreOriginalConsole() {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
}

// Initialize filtering immediately
initializeLogFiltering();

// Export utilities
export {
  LOG_FILTERS,
  initializeLogFiltering,
  restoreOriginalConsole,
  shouldFilterLog
};

// For debugging - enable all logs temporarily
export const enableAllLogs = () => {
  Object.keys(LOG_FILTERS).forEach(key => {
    LOG_FILTERS[key] = true;
  });
  console.log('✅ All logs enabled');
};

// For production - disable all logs
export const disableAllLogs = () => {
  Object.keys(LOG_FILTERS).forEach(key => {
    LOG_FILTERS[key] = false;
  });
  console.log('🔇 All logs disabled');
};

// Quick configuration presets
export const logPresets = {
  // Only show errors and warnings
  QUIET: () => {
    Object.keys(LOG_FILTERS).forEach(key => {
      LOG_FILTERS[key] = key === 'ERROR_LOGS' || key === 'WARNING_LOGS';
    });
  },
  
  // Show only important logs
  MINIMAL: () => {
    Object.keys(LOG_FILTERS).forEach(key => {
      LOG_FILTERS[key] = ['ERROR_LOGS', 'WARNING_LOGS', 'SUCCESS_LOGS', 'INFO_LOGS'].includes(key);
    });
  },
  
  // Show everything for debugging
  VERBOSE: () => {
    Object.keys(LOG_FILTERS).forEach(key => {
      LOG_FILTERS[key] = true;
    });
  }
};

auth('🔧 Log filtering initialized - Auth, Tenant, API, and Component logs are silenced');
console.log('📝 To enable specific logs, modify LOG_FILTERS in src/utils/logConfig.js');
