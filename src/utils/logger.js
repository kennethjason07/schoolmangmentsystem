/**
 * Enhanced Logger Utility
 * 
 * Centralized logging with configurable verbosity levels
 * Use this to control which logs appear in the console across the app
 */

// Configuration for different log types
// Set to false to disable specific log categories
const LOG_CONFIG = {
  // Authentication logs
  AUTH: false,
  
  // Tenant-related logs
  TENANT: false,
  
  // API and data fetching
  API: false,
  
  // Component lifecycle and rendering
  COMPONENT: false,
  
  // Real-time subscriptions and WebSocket
  REALTIME: false,
  
  // Cache operations and state management
  CACHE: true,
  
  // Performance metrics
  PERFORMANCE: true,
  
  // Errors (always enabled in development)
  ERROR: true,
  
  // Warnings
  WARNING: true,
  
  // Debug information
  DEBUG: false,
  
  // General info (minimal, important logs)
  INFO: true
};

// Master switch to enable/disable all logs
// Set to false to completely silence all logs
const ENABLE_LOGS = true;

// Enable more verbose logging in development
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Enhanced logger with categories and formatting
 */
const logger = {
  // Log authentication-related messages
  auth: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.AUTH || isDev)) {
      console.log(`🔐 [AUTH] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log tenant-related messages
  tenant: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.TENANT || isDev)) {
      console.log(`🏢 [TENANT] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log API calls and data fetching
  api: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.API || isDev)) {
      console.log(`🔄 [API] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log component lifecycle events
  component: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.COMPONENT || isDev)) {
      console.log(`🧩 [COMPONENT] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log real-time events and subscriptions
  realtime: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.REALTIME || isDev)) {
      console.log(`⚡ [REALTIME] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log cache operations
  cache: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.CACHE || isDev)) {
      console.log(`📦 [CACHE] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log performance metrics
  perf: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.PERFORMANCE || isDev)) {
      console.log(`⚡ [PERF] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log errors (these will always show in development)
  error: (message, error) => {
    if (ENABLE_LOGS && (LOG_CONFIG.ERROR || isDev)) {
      console.error(`❌ [ERROR] ${message}`, error !== undefined ? error : '');
    }
  },
  
  // Log warnings
  warn: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.WARNING || isDev)) {
      console.warn(`⚠️ [WARNING] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log debug information
  debug: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.DEBUG || isDev)) {
      console.log(`🔍 [DEBUG] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Log general information
  info: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.INFO || isDev)) {
      console.log(`ℹ️ [INFO] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // Success messages (always shown by default)
  success: (message, data) => {
    if (ENABLE_LOGS) {
      console.log(`✅ [SUCCESS] ${message}`, data !== undefined ? data : '');
    }
  },
  
  // A specialized log for the optimized attendance screen
  attendance: (message, data) => {
    if (ENABLE_LOGS && (LOG_CONFIG.PERFORMANCE || isDev)) {
      console.log(`📊 [ATTENDANCE] ${message}`, data !== undefined ? data : '');
    }
  }
};

export default logger;

// Export individual log functions for direct import
export const { 
  auth, tenant, api, component, realtime, 
  cache, perf, error, warn, debug, info, success, 
  attendance
} = logger;

// Export a way to configure logging at runtime
export const configureLogging = (config) => {
  Object.keys(config).forEach(key => {
    if (LOG_CONFIG.hasOwnProperty(key)) {
      LOG_CONFIG[key] = config[key];
    }
  });
};

// Utility to disable all logs (use for production)
export const disableAllLogs = () => {
  Object.keys(LOG_CONFIG).forEach(key => {
    LOG_CONFIG[key] = false;
  });
};

// Utility to enable all logs (use for debugging)
export const enableAllLogs = () => {
  Object.keys(LOG_CONFIG).forEach(key => {
    LOG_CONFIG[key] = true;
  });
};
