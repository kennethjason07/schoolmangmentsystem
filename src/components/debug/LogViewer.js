import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Share,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { colors } from '../../../assets/colors';

// Log storage
let logMessages = [];
let logListeners = [];

// Override console methods to capture logs
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

const addLogMessage = (level, args) => {
  const timestamp = new Date().toLocaleTimeString();
  
  // DEFERRED PROCESSING: Only process if listener is active or when idle
  // This reduces the main thread blockage (Violation warnings)
  const processLog = () => {
    const message = args.map(arg => {
      try {
        if (typeof arg === 'object' && arg !== null) {
          // Limit object depth for performance
          return JSON.stringify(arg);
        }
        return String(arg);
      } catch (e) {
        return '[Unserializable Object]';
      }
    }).join(' ');
    
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp,
      level,
      message,
      fullMessage: args
    };
    
    logMessages.unshift(logEntry);
    if (logMessages.length > 100) {
      logMessages = logMessages.slice(0, 100);
    }
    
    // Notify listeners - but only if there are any to save time
    if (logListeners.length > 0) {
      logListeners.forEach(listener => listener(logMessages));
    }
  };

  // Move processing off the immediate stack to avoid blocking critical auth code
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.requestIdleCallback) {
    window.requestIdleCallback(() => processLog(), { timeout: 200 });
  } else {
    setTimeout(processLog, 10);
  }
};

// Override console methods
console.log = (...args) => {
  // Filter out noisy connection/system logs
  const logString = args.map(a => String(a)).join(' ');
  
  // System/framework logs
  if (
    logString.includes('Running application "main" with appParams') ||
    logString.includes('Development-level warnings: ON') ||
    logString.includes('Performance optimizations: OFF') ||
    logString.includes('Optimized polyfills loaded') || 
    logString.includes('Polyfills loaded successfully')
  ) {
    return;
  }
  
  // Login flow logs
  /* 🔓 RELAXED: Allow login logs for debugging
  if (
    logString.includes('handleLogin called') ||
    logString.includes('Login details:') ||
    logString.includes('Starting validation checks') ||
    logString.includes('Email validation:') ||
    logString.includes('Password validation:') ||
    logString.includes('Validating role:') ||
    logString.includes('Starting role validation') ||
    (logString.includes('Found') && logString.includes('roles in database')) ||
    logString.includes('Looking for role name:') ||
    logString.includes('Role validation successful') ||
    logString.includes('All validations passed') ||
    logString.includes('Skipping tenant validation') ||
    logString.includes('Clearing any invalid auth data') ||
    logString.includes('Using AuthFix for safe sign in') ||
    logString.includes('Attempting safe sign in') ||
    logString.includes('Web platform - skipping session clear') ||
    logString.includes('Calling Supabase signInWithPassword') ||
    logString.includes('SignIn response received') ||
    logString.includes('Sign in successful') ||
    (logString.includes('User:') && logString.includes('@')) ||
    logString.includes('Checking if session was stored') ||
    logString.includes('Post-signIn session check')
  ) {
    return;
  }
  */

  // Additional filters for specific noisy logs
  if (
    logString.includes('TenantContext (init)') ||
    (logString.includes('marks_card') && logString.includes('GRANTED for user'))
  ) {
    return;
  }
  
  // 🚀 OPTIMIZED: Keep filters for very noisy repetitive logs only
  if (
    logString.includes('tenantHelpers:') ||
    logString.includes('SupabaseService -') ||
    logString.includes('[UniversalNotificationService]')
  ) {
    return;
  }
  
  /* 🔓 RELAXED: Allow core tenant logs
  if (
    logString.includes('TenantProvider:') ||
    logString.includes('TenantContext:') ||
    logString.includes('Tenant helpers initialized') ||
    logString.includes('Email-based tenant loading') ||
    logString.includes('Successfully loaded tenant') ||
    logString.includes('Shared TenantUtils:') ||
    logString.includes('All tenant data cleared') ||
    logString.includes('Using cached tenant ID')
  ) {
    return;
  }
  */
  
  // Parent/Student context logs
  if (
    logString.includes('[SelectedStudentContext]') ||
    logString.includes('[PARENT AUTH]') ||
    logString.includes('Loading students for parent') ||
    logString.includes('User is not a parent') ||
    logString.includes('Logo loaded successfully') ||
    logString.includes('SelectedStudentContext:') ||
    logString.includes('Target student ID:')
  ) {
    return;
  }
  
  // Startup loader logs
  if (
    logString.includes('StartupLoader:') ||
    logString.includes('Tenant already initialized, startup complete')
  ) {
    return;
  }
  
  // 🚀 OPTIMIZED: Hide core auth/tenant logs that are confirmed working
  if (
    logString.includes('Querying user profile') ||
    logString.includes('Auth user info:') ||
    logString.includes('Target tenant ID:') ||
    logString.includes('Executing exact match query') ||
    logString.includes('Exact match result:') ||
    logString.includes('Profile found:') ||
    logString.includes('User profile found:') ||
    logString.includes('Found role in database:') ||
    logString.includes('Role validation:') ||
    logString.includes('Setting user and userType') ||
    logString.includes('About to set user:') ||
    logString.includes('About to set userType:') ||
    logString.includes('Setting tenant context during signIn') ||
    logString.includes('State updated - loading set to false') ||
    logString.includes('isSigningIn flag cleared') ||
    logString.includes('Web debug - final state check') ||
    logString.includes('Login successful - styles restored') ||
    logString.includes('AuthFix sign in successful') ||
    logString.includes('Push notifications skipped') ||
    logString.includes('CURRENT USER:') ||
    logString.includes('Skipping role validation due to timeout') ||
    logString.includes('Session is valid') ||
    logString.includes('Web platform - skipping session refresh') ||
    logString.includes('Force sign out complete') ||
    logString.includes('Setting tenant context for:') ||
    logString.includes('No active session found, skipping RPC call') ||
    logString.includes('Profile data:') ||
    logString.includes('Error: None') ||
    logString.includes('Error code: None') ||
    logString.includes('Error details: None') ||
    logString.includes('Platform: web') ||
    logString.includes('Valid session found, proceeding with auth') ||
    logString.includes('Successfully set tenant context via RPC') ||
    logString.includes('TenantContext: Already initialized, using cached data')
  ) {
    return;
  }

  // Fee Management logs (Noisy calculation details)
  if (
    logString.includes('Processing fee data with discount support') ||
    logString.includes('Starting class-wise fee calculation') ||
    logString.includes('📊 Processing class') ||
    logString.includes('Student-specific fee for') ||
    logString.includes('Applied') && logString.includes('discount for') ||
    logString.includes('Class fee for') && logString.includes('no discount') ||
    logString.includes('Skipping class fee for') ||
    logString.includes('Student') && logString.includes('Expected=₹') && logString.includes('Paid=₹') ||
    logString.includes('Class totals: Expected=₹') ||
    logString.includes('Recalculated Outstanding for consistency') ||
    logString.includes('Fee calculation completed with discount support') ||
    logString.includes('=== Fee Calculation Start ===') ||
    logString.includes('📊 Step 5: Processing grouped class fees') ||
    logString.includes('--- 🎯 Processing CLASS FEE:') ||
    logString.includes('💸 Final amount calculation:') ||
    logString.includes('💯 Final Result:') ||
    logString.includes('=== 🔥 ENHANCED FINAL CALCULATION SUMMARY ===') ||
    logString.includes('Calculating fee stats (OPTIMIZED)') ||
    logString.includes('OPTIMIZED Fee Stats - Total Paid Amount') ||
    logString.includes('Starting ULTRA-FAST batch loading') ||
    logString.includes('ULTRA-FAST loading completed in') ||
    logString.includes('SafeNavigate')
  ) {
    return;
  }
  
  originalLog(...args);
  addLogMessage('log', args);
};

console.error = (...args) => {
  // Filter out known noisy errors
  const logString = args.map(a => String(a)).join(' ');
  
  // Filter out "Unexpected text node" errors (not actual errors per user)
  if (logString.includes('Unexpected text node')) {
    return;
  }
  
  // Filter out query retry and timeout errors (expected during slow connections)
  if (
    logString.includes('All retry attempts failed') ||
    logString.includes('User profile query failed') ||
    logString.includes('Error fetching user profile') ||
    logString.includes('Database query timed out')
  ) {
    return;
  }
  
  originalError(...args);
  addLogMessage('error', args);
};

console.warn = (...args) => {
  const logString = args.map(a => String(a)).join(' ');
  
  // Filter out auth/parent warnings that are expected
  if (
    logString.includes('No cached tenant ID available') ||
    logString.includes('[AUTH] Push notification initialization failed') ||
    logString.includes('[PARENT AUTH] No students found') ||
    logString.includes('[PARENT AUTH] No parent records found') ||
    logString.includes('Query timeout after') ||
    logString.includes('Role validation timed out') ||
    logString.includes('Query attempt') && logString.includes('failed') ||
    logString.includes('"shadow*" style props are deprecated') ||
    logString.includes('"textShadow*" style props are deprecated') ||
    logString.includes('props.pointerEvents is deprecated') ||
    logString.includes('[expo-notifications] Listening to push token changes') ||
    logString.includes('Cannot record touch end without a touch start') ||
    logString.includes('boxShadow')
  ) {
    return;
  }
  
  originalWarn(...args);
  addLogMessage('warn', args);
};

const LogViewer = ({ visible, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Subscribe to log updates
    const updateLogs = (newLogs) => {
      setLogs([...newLogs]);
    };
    
    logListeners.push(updateLogs);
    setLogs([...logMessages]); // Initial load
    
    return () => {
      // Cleanup listener
      logListeners = logListeners.filter(listener => listener !== updateLogs);
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'leave') return log.message.includes('[LEAVE_MGMT]') || log.message.includes('leave');
    if (filter === 'auth') return log.message.includes('[AUTH]') || log.message.includes('auth');
    if (filter === 'error') return log.level === 'error';
    return log.level === filter;
  });

  const clearLogs = () => {
    logMessages = [];
    setLogs([]);
    logListeners.forEach(listener => listener([]));
  };

  const shareLogs = async () => {
    try {
      const logText = filteredLogs.map(log => 
        `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
      ).join('\n');
      
      await Share.share({
        message: logText,
        title: 'Leave Management Debug Logs'
      });
    } catch (error) {
      console.error('Error sharing logs:', error);
    }
  };

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return colors.error;
      case 'warn': return colors.warning;
      case 'log': return colors.text;
      default: return colors.textSecondary;
    }
  };

  const getLogIcon = (level) => {
    switch (level) {
      case 'error': return 'alert-circle';
      case 'warn': return 'warning';
      case 'log': return 'information-circle';
      default: return 'ellipse';
    }
  };

  const renderLogItem = ({ item }) => (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Ionicons 
          name={getLogIcon(item.level)} 
          size={16} 
          color={getLogColor(item.level)} 
        />
        <Text style={styles.logTimestamp}>{item.timestamp}</Text>
        <Text style={[styles.logLevel, { color: getLogColor(item.level) }]}>
          {item.level.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.logMessage}>{item.message}</Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Debug Logs</Text>
          <TouchableOpacity onPress={clearLogs} style={styles.headerButton}>
            <Ionicons name="trash" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.filterContainer}>
          {['all', 'leave', 'auth', 'error'].map(filterType => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterButton,
                filter === filterType && styles.filterButtonActive
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text style={[
                styles.filterButtonText,
                filter === filterType && styles.filterButtonTextActive
              ]}>
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.logContainer}>
          {filteredLogs.map(log => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Ionicons 
                  name={getLogIcon(log.level)} 
                  size={16} 
                  color={getLogColor(log.level)} 
                />
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                  {log.level.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.actionButton} onPress={shareLogs}>
            <Ionicons name="share" size={20} color={colors.white} />
            <Text style={styles.actionButtonText}>Share Logs</Text>
          </TouchableOpacity>
          <Text style={styles.logCount}>
            {filteredLogs.length} of {logs.length} logs
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: colors.background,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  logContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  logItem: {
    backgroundColor: colors.white,
    marginVertical: 4,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logTimestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    marginRight: 8,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  logMessage: {
    fontSize: 13,
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 18,
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  logCount: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default LogViewer;

// Export functions to control logging
export const getLogMessages = () => logMessages;
export const clearLogMessages = () => {
  logMessages = [];
  logListeners.forEach(listener => listener([]));
};
export const addLogListener = (listener) => {
  logListeners.push(listener);
};
export const removeLogListener = (listener) => {
  logListeners = logListeners.filter(l => l !== listener);
};
