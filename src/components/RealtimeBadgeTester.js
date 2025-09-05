import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';
import universalNotificationService from '../services/UniversalNotificationService';
import UniversalNotificationBadge from './UniversalNotificationBadge';

/**
 * RealtimeBadgeTester - Component for testing and debugging notification badge updates
 * Shows real-time badge counts and provides testing buttons for developers
 */
const RealtimeBadgeTester = () => {
  const { user, userType } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState({ messageCount: 0, notificationCount: 0, totalCount: 0 });
  const [subscriptionStatus, setSubscriptionStatus] = useState('inactive');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [testResults, setTestResults] = useState([]);

  // Test notification read broadcast
  const testNotificationRead = async () => {
    if (!user?.id) return;
    
    try {
      await universalNotificationService.broadcastNotificationRead(user.id, 'test-notification-123');
      addTestResult('Notification Read', 'success', 'Broadcast notification read event');
    } catch (error) {
      addTestResult('Notification Read', 'error', error.message);
    }
  };

  // Test message read broadcast
  const testMessageRead = async () => {
    if (!user?.id) return;
    
    try {
      await universalNotificationService.broadcastMessageRead(user.id, 'test-sender-456');
      addTestResult('Message Read', 'success', 'Broadcast message read event');
    } catch (error) {
      addTestResult('Message Read', 'error', error.message);
    }
  };

  // Test manual count fetch
  const testFetchCounts = async () => {
    if (!user?.id || !userType) return;
    
    try {
      const result = await universalNotificationService.getUnreadCounts(user.id, userType);
      setCounts(result);
      addTestResult('Fetch Counts', 'success', `Fetched: ${JSON.stringify(result)}`);
    } catch (error) {
      addTestResult('Fetch Counts', 'error', error.message);
    }
  };

  // Clear cache and refresh
  const testClearCache = async () => {
    if (!user?.id || !userType) return;
    
    try {
      universalNotificationService.clearCache(user.id, userType);
      await testFetchCounts();
      addTestResult('Clear Cache', 'success', 'Cache cleared and counts refreshed');
    } catch (error) {
      addTestResult('Clear Cache', 'error', error.message);
    }
  };

  // Add test result
  const addTestResult = (test, status, message) => {
    const result = {
      id: Date.now(),
      test,
      status,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setTestResults(prev => [result, ...prev].slice(0, 10)); // Keep last 10 results
  };

  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      default: return '#666';
    }
  };

  if (!__DEV__) {
    return null; // Only show in development mode
  }

  return (
    <>
      {/* Floating test button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setIsVisible(true)}
      >
        <Ionicons name="bug" size={24} color="#fff" />
        <UniversalNotificationBadge 
          style={{ top: -8, right: -8 }}
          onCountChange={(newCounts) => {
            setCounts(newCounts);
            setLastUpdate(new Date().toLocaleTimeString());
          }}
        />
      </TouchableOpacity>

      {/* Test modal */}
      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>🔔 Badge Tester</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsVisible(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {/* Current Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Status</Text>
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>User:</Text>
                  <Text style={styles.value}>{user?.email || 'Not logged in'}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Type:</Text>
                  <Text style={styles.value}>{userType || 'Unknown'}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Messages:</Text>
                  <Text style={styles.value}>{counts.messageCount}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Notifications:</Text>
                  <Text style={styles.value}>{counts.notificationCount}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Total:</Text>
                  <Text style={[styles.value, styles.totalCount]}>{counts.totalCount}</Text>
                </View>
                <View style={styles.statusRow}>
                  <Text style={styles.label}>Last Update:</Text>
                  <Text style={styles.value}>{lastUpdate || 'Never'}</Text>
                </View>
              </View>
            </View>

            {/* Test Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Test Actions</Text>
              
              <TouchableOpacity style={styles.testButton} onPress={testFetchCounts}>
                <Ionicons name="refresh" size={20} color="#2196F3" />
                <Text style={styles.buttonText}>Fetch Counts</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testNotificationRead}>
                <Ionicons name="notifications" size={20} color="#FF9800" />
                <Text style={styles.buttonText}>Test Notification Read</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testMessageRead}>
                <Ionicons name="chatbubble" size={20} color="#4CAF50" />
                <Text style={styles.buttonText}>Test Message Read</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.testButton} onPress={testClearCache}>
                <Ionicons name="trash" size={20} color="#F44336" />
                <Text style={styles.buttonText}>Clear Cache</Text>
              </TouchableOpacity>
            </View>

            {/* Test Results */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Test Results</Text>
              {testResults.length === 0 ? (
                <Text style={styles.noResults}>No test results yet</Text>
              ) : (
                testResults.map((result) => (
                  <View key={result.id} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultTest}>{result.test}</Text>
                      <Text style={styles.resultTime}>{result.timestamp}</Text>
                    </View>
                    <Text style={[
                      styles.resultStatus,
                      { color: getStatusColor(result.status) }
                    ]}>
                      {result.status.toUpperCase()}
                    </Text>
                    <Text style={styles.resultMessage}>{result.message}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Badge Preview */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Badge Preview</Text>
              <View style={styles.badgePreview}>
                <View style={styles.iconWithBadge}>
                  <Ionicons name="notifications" size={32} color="#666" />
                  <UniversalNotificationBadge />
                </View>
                <Text style={styles.previewLabel}>Bell Icon with Badge</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1001,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  totalCount: {
    fontSize: 16,
    color: '#2196F3',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  buttonText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
    fontWeight: '500',
  },
  noResults: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    padding: 20,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultTest: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultMessage: {
    fontSize: 12,
    color: '#666',
  },
  badgePreview: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  iconWithBadge: {
    position: 'relative',
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: '#666',
  },
});

export default RealtimeBadgeTester;
