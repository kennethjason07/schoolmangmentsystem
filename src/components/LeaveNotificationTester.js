import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createLeaveRequestNotificationForAdmins } from '../services/notificationService';
import { supabase } from '../utils/supabase';

/**
 * Leave Notification Tester Component
 * Use this component in your admin screen to test leave request notifications
 */
const LeaveNotificationTester = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const runTest = async () => {
    try {
      setTesting(true);
      setResults(null);

      console.log('🧪 [LEAVE NOTIFICATION TEST] Starting test...');

      // Step 1: Check admin users
      const { data: adminUsers, error: adminError } = await supabase
        .from('users')
        .select('id, full_name, email, role_id')
        .eq('role_id', 1);
      
      if (adminError) {
        throw new Error(`Admin users query failed: ${adminError.message}`);
      }

      // Step 2: Check push tokens
      let tokensCount = 0;
      if (adminUsers && adminUsers.length > 0) {
        for (const admin of adminUsers) {
          const { data: tokens } = await supabase
            .from('push_tokens')
            .select('id')
            .eq('user_id', admin.id)
            .eq('is_active', true);
          tokensCount += tokens?.length || 0;
        }
      }

      // Step 3: Create test leave request notification
      const mockLeaveData = {
        leave_type: 'Sick Leave',
        start_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        end_date: new Date(Date.now() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        reason: `Push notification test - ${new Date().toLocaleTimeString()}`,
        total_days: 1
      };

      const mockTeacherData = {
        full_name: 'Test Teacher (Notification Test)',
        teacher: {
          name: 'Test Teacher (Notification Test)'
        },
        linked_teacher_id: 'test-teacher-id'
      };

      const result = await createLeaveRequestNotificationForAdmins(
        mockLeaveData,
        mockTeacherData,
        'test-teacher-user-id'
      );

      const testResults = {
        adminCount: adminUsers?.length || 0,
        tokensCount,
        notificationSuccess: result.success,
        notificationId: result.notification?.id,
        recipientCount: result.recipientCount,
        error: result.error,
        mockData: mockLeaveData,
        teacherName: mockTeacherData.full_name
      };

      setResults(testResults);

      if (result.success) {
        Alert.alert(
          '✅ Test Successful!',
          `Created notification for ${result.recipientCount} admin(s).\n\nCheck your admin devices for push notifications!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Test Failed',
          `Error: ${result.error}`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
      Alert.alert(
        '❌ Test Error',
        error.message,
        [{ text: 'OK' }]
      );
    } finally {
      setTesting(false);
    }
  };

  const formatJson = (obj) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={24} color="#2196F3" />
        <Text style={styles.title}>Leave Notification Tester</Text>
      </View>
      
      <Text style={styles.description}>
        This component tests the complete leave request notification flow including push notifications to admin devices.
      </Text>

      <TouchableOpacity
        style={[styles.testButton, testing && styles.disabledButton]}
        onPress={runTest}
        disabled={testing}
      >
        {testing ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Ionicons name="play" size={20} color="#FFFFFF" />
        )}
        <Text style={styles.testButtonText}>
          {testing ? 'Testing...' : 'Run Leave Notification Test'}
        </Text>
      </TouchableOpacity>

      {results && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results</Text>
          
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📊 System Status</Text>
            <Text style={styles.resultText}>Admin Users: {results.adminCount}</Text>
            <Text style={styles.resultText}>Active Push Tokens: {results.tokensCount}</Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📧 Notification Result</Text>
            <Text style={[
              styles.resultText, 
              { color: results.notificationSuccess ? '#4CAF50' : '#F44336' }
            ]}>
              Status: {results.notificationSuccess ? 'SUCCESS' : 'FAILED'}
            </Text>
            {results.notificationSuccess && (
              <>
                <Text style={styles.resultText}>Notification ID: {results.notificationId}</Text>
                <Text style={styles.resultText}>Recipients: {results.recipientCount}</Text>
              </>
            )}
            {results.error && (
              <Text style={[styles.resultText, { color: '#F44336' }]}>
                Error: {results.error}
              </Text>
            )}
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>📱 Expected Push Notification</Text>
            <Text style={styles.resultText}>Title: "New Leave Request"</Text>
            <Text style={styles.resultText}>
              Message: "{results.teacherName} has submitted a {results.mockData.leave_type} request ({results.mockData.start_date} to {results.mockData.end_date})"
            </Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>🔍 Next Steps</Text>
            <Text style={styles.resultText}>1. Check admin devices for push notifications</Text>
            <Text style={styles.resultText}>2. Verify AdminNotifications screen shows new notification</Text>
            <Text style={styles.resultText}>3. Test actual teacher leave request submission</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    margin: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 15,
    maxHeight: 400,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  resultSection: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
});

export default LeaveNotificationTester;