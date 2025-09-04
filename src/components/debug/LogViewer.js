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
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logEntry = {
    id: Date.now() + Math.random(),
    timestamp,
    level,
    message,
    fullMessage: args
  };
  
  logMessages.unshift(logEntry); // Add to beginning
  
  // Keep only last 100 logs to prevent memory issues
  if (logMessages.length > 100) {
    logMessages = logMessages.slice(0, 100);
  }
  
  // Notify listeners
  logListeners.forEach(listener => listener(logMessages));
};

// Override console methods
console.log = (...args) => {
  originalLog(...args);
  addLogMessage('log', args);
};

console.error = (...args) => {
  originalError(...args);
  addLogMessage('error', args);
};

console.warn = (...args) => {
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
    gap: 8,
  },
  actionButtonText: {
    color: colors.white,
    fontWeight: '600',
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
