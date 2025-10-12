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
import { createLeaveStatusNotificationForTeacher } from '../services/notificationService';
import { supabase } from '../utils/supabase';
import { useAuth } from '../utils/AuthContext';

/**
 * Teacher Leave Notification Tester Component
 * Use this component in your teacher screen to test leave status notifications
 */
const TeacherLeaveNotificationTester = () => {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);

  const runApprovedTest = async () => {
    await runStatusTest('Approved');
  };

  const runRejectedTest = async () => {
    await runStatusTest('Rejected');
  };

  const runStatusTest = async (status) => {
    try {
      setTesting(true);
      setResults(null);

      console.log(`🧪 [TEACHER LEAVE NOTIFICATION TEST] Starting ${status} test...`);

      // Step 1: Check if current user is a teacher
      const { data: teacherUser, error: teacherError } = await supabase
        .from('users')
        .select('id, full_name, linked_teacher_id')
        .eq('id', user?.id)
        .single();
      
      if (teacherError || !teacherUser?.linked_teacher_id) {
        throw new Error('User is not linked to a teacher profile');
      }

      // Step 2: Check push tokens for current user
      const { data: tokens, error: tokenError } = await supabase
        .from('push_tokens')
        .select('id, token, is_active, updated_at')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (tokenError) {
        throw new Error(`Push tokens query failed: ${tokenError.message}`);
      }

      // Step 3: Create mock leave data
      const mockLeaveData = {
        teacher_id: teacherUser.linked_teacher_id,
        leave_type: 'Test Leave',
        start_date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        end_date: new Date(Date.now() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };

      const mockAdminRemarks = status === 'Approved' 
        ? `Test notification: Leave ${status.toLowerCase()} - ${new Date().toLocaleTimeString()}`
        : `Test notification: Leave ${status.toLowerCase()} due to testing purposes - ${new Date().toLocaleTimeString()}`;

      // Step 4: Create test leave status notification
      const result = await createLeaveStatusNotificationForTeacher(
        mockLeaveData,
        status,
        mockAdminRemarks,
        'test-admin-user-id'
      );

      const testResults = {
        userLinkedToTeacher: !!teacherUser.linked_teacher_id,
        tokensCount: tokens?.length || 0,
        notificationSuccess: result.success,
        notificationId: result.notification?.id,
        teacherUserId: result.teacherUserId,
        teacherName: result.teacherName,
        error: result.error,
        status: status,
        mockData: mockLeaveData,
        adminRemarks: mockAdminRemarks
      };

      setResults(testResults);

      if (result.success) {
        Alert.alert(
          `✅ ${status} Test Successful!`,
          `Created ${status.toLowerCase()} notification for teacher.\n\nCheck your device for the push notification!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          `❌ ${status} Test Failed`,
          `Error: ${result.error}`,
          [{ text: 'OK' }]
        );
      }

    } catch (error) {
      console.error(`❌ ${status} test failed:`, error);
      Alert.alert(
        `❌ ${status} Test Error`,
        error.message,
        [{ text: 'OK' }]
      );
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="school" size={24} color="#4CAF50" />
        <Text style={styles.title}>Teacher Leave Status Tester</Text>
      </View>
      
      <Text style={styles.description}>
        This component tests push notifications that teachers receive when their leave requests are approved or rejected by admins.
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.testButton, styles.approvedButton, testing && styles.disabledButton]}
          onPress={runApprovedTest}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.testButtonText}>
            {testing ? 'Testing...' : 'Test Approved Notification'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.testButton, styles.rejectedButton, testing && styles.disabledButton]}
          onPress={runRejectedTest}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="close-circle" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.testButtonText}>
            {testing ? 'Testing...' : 'Test Rejected Notification'}
          </Text>
        </TouchableOpacity>
      </View>

      {results && (
        <ScrollView style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Test Results</Text>
          
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>👤 User Status</Text>
            <Text style={styles.resultText}>Linked to Teacher: {results.userLinkedToTeacher ? 'Yes' : 'No'}</Text>
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
                <Text style={styles.resultText}>Teacher: {results.teacherName}</Text>
                <Text style={styles.resultText}>Leave Status: {results.status}</Text>
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
            <Text style={styles.resultText}>
              Title: "Leave Request {results.status}"
            </Text>
            <Text style={styles.resultText}>
              Message: "Your {results.mockData.leave_type} request has been {results.status.toLowerCase()}"
            </Text>
            <Text style={styles.resultText}>
              Priority: {results.status === 'Rejected' ? 'Urgent' : 'High'}
            </Text>
          </View>

          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>🔍 Next Steps</Text>
            <Text style={styles.resultText}>1. Check your device for push notification</Text>
            <Text style={styles.resultText}>2. Verify TeacherNotifications screen shows new notification</Text>
            <Text style={styles.resultText}>3. Test actual admin approval/rejection process</Text>
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  approvedButton: {
    backgroundColor: '#4CAF50',
  },
  rejectedButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
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

export default TeacherLeaveNotificationTester;