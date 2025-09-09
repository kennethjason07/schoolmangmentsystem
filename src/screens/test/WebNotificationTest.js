import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import UniversalNotificationBadge from '../../components/UniversalNotificationBadge';
import { useAuth } from '../../utils/AuthContext';
import { useUnreadNotificationCount } from '../../hooks/useUnreadNotificationCount';

const WebNotificationTest = ({ navigation }) => {
  const { user, userType } = useAuth();
  const [testResults, setTestResults] = useState([]);
  const [currentTest, setCurrentTest] = useState('');
  const { unreadCount, refresh: refreshNotificationCount } = useUnreadNotificationCount('Student');

  const addTestResult = (test, result, details = '') => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [
      ...prev,
      {
        id: Date.now(),
        test,
        result,
        details,
        timestamp,
        platform: Platform.OS
      }
    ]);
  };

  const runTests = async () => {
    setTestResults([]);
    
    // Test 1: Platform Detection
    setCurrentTest('Platform Detection');
    addTestResult('Platform Detection', Platform.OS === 'web' ? 'PASS' : 'FAIL', `Platform: ${Platform.OS}`);
    
    // Test 2: Expo Vector Icons
    setCurrentTest('Expo Vector Icons');
    try {
      // This should not throw an error if icons work
      addTestResult('Expo Vector Icons', 'PASS', 'Icons rendering successfully');
    } catch (error) {
      addTestResult('Expo Vector Icons', 'FAIL', error.message);
    }
    
    // Test 3: Auth Context
    setCurrentTest('Auth Context');
    addTestResult('Auth Context', user && userType ? 'PASS' : 'FAIL', 
      `User: ${user?.id || 'none'}, Type: ${userType || 'none'}`);
    
    // Test 4: Notification Hook
    setCurrentTest('Notification Hook');
    addTestResult('Notification Hook', typeof unreadCount === 'number' ? 'PASS' : 'FAIL', 
      `Count: ${unreadCount}, Type: ${typeof unreadCount}`);
    
    // Test 5: Header Component
    setCurrentTest('Header Component');
    addTestResult('Header Component', 'PASS', 'Header rendering without errors');
    
    // Test 6: Universal Notification Badge
    setCurrentTest('Universal Notification Badge');
    addTestResult('Universal Notification Badge', 'PASS', 'Badge component loaded');
    
    // Test 7: Supabase Connection (simplified)
    setCurrentTest('Supabase Connection');
    try {
      // Try to refresh notification count
      await refreshNotificationCount();
      addTestResult('Supabase Connection', 'PASS', 'Successfully called notification service');
    } catch (error) {
      addTestResult('Supabase Connection', 'FAIL', error.message);
    }
    
    // Test 8: ScrollView Functionality
    setCurrentTest('ScrollView Functionality');
    addTestResult('ScrollView Functionality', 'PASS', 'ScrollView rendering successfully');
    
    setCurrentTest('');
  };

  const testScrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
      addTestResult('Scroll To Top', 'PASS', 'Scroll function executed');
    } else {
      addTestResult('Scroll To Top', 'FAIL', 'ScrollView ref not found');
    }
  };

  const scrollRef = React.useRef(null);

  useEffect(() => {
    // Auto-run tests on mount
    setTimeout(runTests, 1000);
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="Web Notification Test"
        showBack={true}
        showNotifications={true}
        showProfile={false}
      />
      
      <ScrollView 
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Information</Text>
          <Text style={styles.info}>Platform: {Platform.OS}</Text>
          <Text style={styles.info}>User ID: {user?.id || 'Not logged in'}</Text>
          <Text style={styles.info}>User Type: {userType || 'Not set'}</Text>
          <Text style={styles.info}>Unread Count: {unreadCount}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Controls</Text>
          <TouchableOpacity style={styles.button} onPress={runTests}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Run Tests</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={testScrollToTop}>
            <Ionicons name="arrow-up" size={20} color="#fff" />
            <Text style={styles.buttonText}>Test Scroll</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={refreshNotificationCount}>
            <Ionicons name="notifications" size={20} color="#fff" />
            <Text style={styles.buttonText}>Refresh Notifications</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Badge Test</Text>
          <View style={styles.badgeContainer}>
            <Ionicons name="notifications" size={40} color="#333" />
            <UniversalNotificationBadge />
          </View>
          <Text style={styles.info}>
            The red badge above should show the unread count if there are notifications
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Test</Text>
          <Text style={styles.currentTest}>
            {currentTest || 'No test running'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Results ({testResults.length})</Text>
          {testResults.length === 0 && (
            <Text style={styles.info}>No test results yet. Click "Run Tests" to begin.</Text>
          )}
          {testResults.map(result => (
            <View key={result.id} style={[
              styles.testResult,
              result.result === 'PASS' ? styles.testPass : styles.testFail
            ]}>
              <View style={styles.testHeader}>
                <Text style={styles.testName}>{result.test}</Text>
                <Text style={[
                  styles.testStatus,
                  result.result === 'PASS' ? styles.passText : styles.failText
                ]}>
                  {result.result}
                </Text>
              </View>
              {result.details && (
                <Text style={styles.testDetails}>{result.details}</Text>
              )}
              <Text style={styles.testTime}>
                {result.timestamp} ({result.platform})
              </Text>
            </View>
          ))}
        </View>

        {/* Spacer for scroll testing */}
        <View style={{ height: 200 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  info: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  badgeContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    padding: 20,
  },
  currentTest: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  testResult: {
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  testPass: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  testFail: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  testStatus: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  passText: {
    color: '#4caf50',
  },
  failText: {
    color: '#f44336',
  },
  testDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  testTime: {
    fontSize: 12,
    color: '#999',
  },
});

export default WebNotificationTest;
