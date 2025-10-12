import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';
import {
  diagnoseParentChatBadge,
  fixParentChatBadge,
  quickFixParentBadge,
  monitorParentChatBadge
} from '../utils/parentChatBadgeUtils';

/**
 * ParentChatBadgeDebugger - Temporary debug component for troubleshooting parent chat badges
 * 
 * This component is only shown in development mode (__DEV__) and provides real-time
 * diagnostic tools for parent chat badge count issues.
 * 
 * Features:
 * - Real-time badge count diagnosis
 * - Cross-tenant message detection
 * - Quick fix options
 * - Live monitoring capabilities
 * 
 * @param {Object} props
 * @param {boolean} props.collapsed - Whether the debugger starts collapsed
 */
const ParentChatBadgeDebugger = ({ collapsed = true }) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [diagnosis, setDiagnosis] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [monitorCleanup, setMonitorCleanup] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Clean up monitoring on unmount
  useEffect(() => {
    return () => {
      if (monitorCleanup) {
        monitorCleanup();
      }
    };
  }, [monitorCleanup]);

  // Run diagnosis
  const runDiagnosis = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found for diagnosis');
      return;
    }

    setIsLoading(true);
    try {
      const results = await diagnoseParentChatBadge(user.id);
      setDiagnosis(results);
      setLastUpdate(new Date());
      
      console.log('🔍 [Debug] Diagnosis complete:', results);
      
      if (results.issues.length === 0) {
        Alert.alert('✅ Diagnosis Complete', 'No issues found with parent chat badge');
      } else {
        const issueCount = results.issues.length;
        Alert.alert(
          '⚠️ Issues Found', 
          `Found ${issueCount} issue${issueCount > 1 ? 's' : ''} affecting badge count. Check the details below.`
        );
      }
    } catch (error) {
      console.error('❌ [Debug] Diagnosis failed:', error);
      Alert.alert('Error', `Diagnosis failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply quick fix
  const applyQuickFix = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found for fix');
      return;
    }

    setIsLoading(true);
    try {
      const results = await quickFixParentBadge(user.id);
      console.log('⚡ [Debug] Quick fix results:', results);
      
      if (results.success) {
        Alert.alert(
          '✅ Quick Fix Applied',
          `Badge count refreshed. Actual count: ${results.actualCount}`
        );
        // Re-run diagnosis to see updated state
        setTimeout(() => runDiagnosis(), 1000);
      } else {
        Alert.alert('❌ Quick Fix Failed', results.error);
      }
    } catch (error) {
      console.error('❌ [Debug] Quick fix failed:', error);
      Alert.alert('Error', `Quick fix failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply full fix
  const applyFullFix = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found for fix');
      return;
    }

    Alert.alert(
      'Full Fix',
      'This will mark cross-tenant messages as read and clear all caches. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply Fix',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const results = await fixParentChatBadge(user.id, ['cross_tenant', 'clear_cache']);
              console.log('🔧 [Debug] Full fix results:', results);
              
              const fixCount = results.fixesApplied.length;
              const errorCount = results.errors.length;
              
              if (fixCount > 0) {
                Alert.alert(
                  '✅ Fixes Applied',
                  `Applied ${fixCount} fix${fixCount > 1 ? 'es' : ''}.${errorCount > 0 ? ` ${errorCount} error${errorCount > 1 ? 's' : ''} occurred.` : ''}`
                );
                // Re-run diagnosis to see updated state
                setTimeout(() => runDiagnosis(), 1000);
              } else if (errorCount > 0) {
                Alert.alert('❌ Fix Failed', `${errorCount} error${errorCount > 1 ? 's' : ''} occurred during fix.`);
              }
            } catch (error) {
              console.error('❌ [Debug] Full fix failed:', error);
              Alert.alert('Error', `Full fix failed: ${error.message}`);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // Toggle monitoring
  const toggleMonitoring = () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found for monitoring');
      return;
    }

    if (isMonitoring) {
      // Stop monitoring
      if (monitorCleanup) {
        monitorCleanup();
        setMonitorCleanup(null);
      }
      setIsMonitoring(false);
      console.log('🛑 [Debug] Stopped badge monitoring');
    } else {
      // Start monitoring
      const cleanup = monitorParentChatBadge(user.id, (update) => {
        console.log('📡 [Debug] Badge monitor update:', update);
        setLastUpdate(new Date());
        
        // Auto-refresh diagnosis when changes occur
        if (update.diagnosis) {
          setDiagnosis(update.diagnosis);
        }
      });
      
      setMonitorCleanup(() => cleanup);
      setIsMonitoring(true);
      console.log('📡 [Debug] Started badge monitoring');
    }
  };

  // Format diagnostic data for display
  const formatDiagnosisForDisplay = (data) => {
    if (!data) return null;

    return (
      <View style={styles.diagnosisContainer}>
        <View style={styles.countsContainer}>
          <Text style={styles.countsTitle}>Message Counts</Text>
          <Text style={styles.countText}>Total Messages: {data.counts.totalMessages}</Text>
          <Text style={[styles.countText, { color: data.counts.unreadMessages > 0 ? '#f44336' : '#4caf50' }]}>
            Unread Messages: {data.counts.unreadMessages}
          </Text>
          <Text style={[styles.countText, { color: data.counts.crossTenantMessages > 0 ? '#ff9800' : '#4caf50' }]}>
            Cross-Tenant Messages: {data.counts.crossTenantMessages}
          </Text>
          <Text style={styles.countText}>Notifications: {data.counts.notifications}</Text>
          <Text style={[styles.countText, styles.expectedCount]}>
            Expected Badge Count: {data.expectedBadgeCount}
          </Text>
        </View>

        {data.issues.length > 0 && (
          <View style={styles.issuesContainer}>
            <Text style={styles.issuesTitle}>Issues Found ({data.issues.length})</Text>
            {data.issues.map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <Text style={styles.issueType}>
                  {typeof issue === 'string' ? issue : issue.description || issue.type}
                </Text>
                {issue.count && (
                  <Text style={styles.issueCount}>Count: {issue.count}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {data.recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>Recommendations</Text>
            {data.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Text style={styles.recommendationAction}>{rec.action}</Text>
                <Text style={styles.recommendationSeverity}>
                  Severity: {rec.severity}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // Don't show in production
  if (!__DEV__) {
    return null;
  }

  return (
    <View style={styles.debugger}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsCollapsed(!isCollapsed)}
      >
        <View style={styles.headerLeft}>
          <Ionicons 
            name="bug" 
            size={16} 
            color="#fff" 
            style={{ marginRight: 8 }} 
          />
          <Text style={styles.headerTitle}>Parent Chat Badge Debug</Text>
        </View>
        <Ionicons
          name={isCollapsed ? "chevron-down" : "chevron-up"}
          size={16}
          color="#fff"
        />
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.content}>
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.button, styles.diagnoseButton]}
              onPress={runDiagnosis}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.buttonText}>🔍 Diagnose</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.quickFixButton]}
              onPress={applyQuickFix}
              disabled={isLoading}
            >
              <Ionicons name="flash" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>⚡ Quick Fix</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.fullFixButton]}
              onPress={applyFullFix}
              disabled={isLoading}
            >
              <Ionicons name="build" size={16} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.buttonText}>🔧 Full Fix</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.monitorButton, isMonitoring && styles.monitoringActive]}
            onPress={toggleMonitoring}
          >
            <Ionicons 
              name={isMonitoring ? "stop" : "play"} 
              size={16} 
              color="#fff" 
              style={{ marginRight: 4 }} 
            />
            <Text style={styles.buttonText}>
              {isMonitoring ? '⏹️ Stop Monitor' : '📡 Start Monitor'}
            </Text>
          </TouchableOpacity>

          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              Last Update: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}

          {diagnosis && (
            <ScrollView style={styles.diagnosisScroll} nestedScrollEnabled={true}>
              {formatDiagnosisForDisplay(diagnosis)}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  debugger: {
    backgroundColor: '#ff5722',
    margin: 10,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#d84315',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    padding: 12,
    backgroundColor: '#fff',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    minHeight: 32,
  },
  diagnoseButton: {
    backgroundColor: '#2196f3',
  },
  quickFixButton: {
    backgroundColor: '#ff9800',
  },
  fullFixButton: {
    backgroundColor: '#f44336',
  },
  monitorButton: {
    backgroundColor: '#9c27b0',
    width: '100%',
    justifyContent: 'center',
  },
  monitoringActive: {
    backgroundColor: '#4caf50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lastUpdate: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  diagnosisScroll: {
    maxHeight: 200,
  },
  diagnosisContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 4,
  },
  countsContainer: {
    marginBottom: 12,
  },
  countsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  countText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  expectedCount: {
    fontWeight: 'bold',
    color: '#2196f3',
    marginTop: 4,
  },
  issuesContainer: {
    marginBottom: 12,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 4,
  },
  issueItem: {
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  issueType: {
    fontSize: 12,
    color: '#d32f2f',
    fontWeight: '500',
  },
  issueCount: {
    fontSize: 10,
    color: '#666',
  },
  recommendationsContainer: {},
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 4,
  },
  recommendationItem: {
    backgroundColor: '#fff3e0',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  recommendationAction: {
    fontSize: 12,
    color: '#f57c00',
    fontWeight: '500',
  },
  recommendationSeverity: {
    fontSize: 10,
    color: '#666',
  },
});

export default ParentChatBadgeDebugger;