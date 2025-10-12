import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../utils/AuthContext';
import { useTenantAccess } from '../utils/tenantHelpers';
import { 
  createAttendanceNotification, 
  findParentUsersForStudent,
  findStudentUserForStudent,
  getActivePushTokensForUser
} from '../utils/attendanceNotificationHelpers';
import { supabase, TABLES } from '../utils/supabase';

const AttendanceNotificationTester = () => {
  const { user } = useAuth();
  const { getTenantId } = useTenantAccess();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState([]);
  const [testResults, setTestResults] = useState(null);

  // Load sample students for testing
  const loadStudents = async () => {
    try {
      setLoading(true);
      const tenantId = getTenantId();
      
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      const { data: studentsData, error } = await supabase
        .from(TABLES.STUDENTS)
        .select(`
          id,
          name,
          class_id,
          classes(class_name, section)
        `)
        .eq('tenant_id', tenantId)
        .limit(5);

      if (error) throw error;

      setStudents(studentsData || []);
      console.log('📚 Loaded students for testing:', studentsData?.length || 0);
      
    } catch (error) {
      console.error('Error loading students:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error loading students: ${error.message}`);
      } else {
        Alert.alert('Error', `Error loading students: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Test attendance notification for a specific student
  const testAttendanceNotification = async (student) => {
    try {
      setLoading(true);
      setTestResults(null);
      
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      console.log('🧪 Testing attendance notification for student:', student.name);

      // Check for parent users
      const parentUsers = await findParentUsersForStudent(student.id, tenantId);
      
      // Check for student user account
      const studentUser = await findStudentUserForStudent(student.id, tenantId);

      // Check push tokens for all users
      const pushTokenResults = [];
      
      for (const parent of parentUsers) {
        const tokens = await getActivePushTokensForUser(parent.userId, tenantId);
        pushTokenResults.push({
          userType: 'parent',
          email: parent.userEmail,
          parentName: parent.parentInfo?.name || 'Unknown',
          tokenCount: tokens.length
        });
      }
      
      if (studentUser) {
        const tokens = await getActivePushTokensForUser(studentUser.userId, tenantId);
        pushTokenResults.push({
          userType: 'student',
          email: studentUser.userEmail,
          tokenCount: tokens.length
        });
      }

      // Create the attendance notification (this will send push notifications)
      const attendanceDate = new Date().toISOString().split('T')[0];
      const result = await createAttendanceNotification({
        studentId: student.id,
        attendanceDate: attendanceDate,
        markedBy: user.id,
        tenantId: tenantId
      });

      const testResult = {
        student: {
          name: student.name,
          className: student.classes?.class_name || 'Unknown',
          section: student.classes?.section || 'Unknown'
        },
        parentUsers: parentUsers.length,
        studentUser: studentUser ? 1 : 0,
        pushTokenResults,
        notificationResult: result,
        timestamp: new Date().toLocaleString()
      };

      setTestResults(testResult);

      const message = `Test completed for ${student.name}:\n\n` +
        `• Parent users found: ${parentUsers.length}\n` +
        `• Student user found: ${studentUser ? 'Yes' : 'No'}\n` +
        `• Push notifications sent: ${result.pushNotificationResults?.successfulPushCount || 0}/${result.pushNotificationResults?.totalUsers || 0}\n` +
        `• In-app notifications: ${result.success ? 'Success' : 'Failed'}\n` +
        `• Recipients: ${result.recipientCount || 0}`;

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Test Results', message);
      }

      console.log('🧪 Test results:', testResult);
      
    } catch (error) {
      console.error('Error testing attendance notification:', error);
      if (Platform.OS === 'web') {
        window.alert(`Test failed: ${error.message}`);
      } else {
        Alert.alert('Test Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Run comprehensive test for all loaded students
  const runComprehensiveTest = async () => {
    if (students.length === 0) {
      Alert.alert('No Students', 'Please load students first.');
      return;
    }

    try {
      setLoading(true);
      setTestResults(null);

      const tenantId = getTenantId();
      const results = [];

      for (const student of students.slice(0, 3)) { // Test first 3 students
        console.log(`🧪 Testing student: ${student.name}`);
        
        try {
          const result = await createAttendanceNotification({
            studentId: student.id,
            attendanceDate: new Date().toISOString().split('T')[0],
            markedBy: user.id,
            tenantId: tenantId
          });
          
          results.push({
            studentName: student.name,
            success: result.success,
            pushCount: result.pushNotificationResults?.successfulPushCount || 0,
            totalUsers: result.pushNotificationResults?.totalUsers || 0,
            recipients: result.recipientCount || 0
          });
        } catch (error) {
          results.push({
            studentName: student.name,
            success: false,
            error: error.message
          });
        }
      }

      const summary = results.reduce((acc, r) => ({
        total: acc.total + 1,
        successful: acc.successful + (r.success ? 1 : 0),
        totalPush: acc.totalPush + (r.pushCount || 0),
        totalRecipients: acc.totalRecipients + (r.recipients || 0)
      }), { total: 0, successful: 0, totalPush: 0, totalRecipients: 0 });

      const message = `Comprehensive Test Results:\n\n` +
        `• Students tested: ${summary.total}\n` +
        `• Successful notifications: ${summary.successful}\n` +
        `• Total push notifications: ${summary.totalPush}\n` +
        `• Total recipients: ${summary.totalRecipients}`;

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Comprehensive Test Results', message);
      }

      setTestResults({ comprehensive: true, results, summary });

    } catch (error) {
      console.error('Error in comprehensive test:', error);
      Alert.alert('Test Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={24} color="#FF9800" />
        <Text style={styles.title}>Attendance Notification Tester</Text>
      </View>

      <Text style={styles.description}>
        Test push notifications for attendance absence alerts to students and parents.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📚 Load Test Data</Text>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={loadStudents}
          disabled={loading}
        >
          <Ionicons name="download" size={16} color="#fff" />
          <Text style={styles.buttonText}>Load Students ({students.length})</Text>
        </TouchableOpacity>
      </View>

      {students.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👨‍🎓 Test Individual Students</Text>
          {students.slice(0, 3).map((student, index) => (
            <TouchableOpacity
              key={student.id}
              style={[styles.button, styles.secondaryButton]}
              onPress={() => testAttendanceNotification(student)}
              disabled={loading}
            >
              <Ionicons name="person" size={16} color="#2196F3" />
              <Text style={styles.secondaryButtonText}>
                Test {student.name} ({student.classes?.class_name || 'Unknown Class'})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {students.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔄 Comprehensive Test</Text>
          <TouchableOpacity 
            style={[styles.button, styles.warningButton]} 
            onPress={runComprehensiveTest}
            disabled={loading}
          >
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={styles.buttonText}>Test All Students (Batch)</Text>
          </TouchableOpacity>
        </View>
      )}

      {testResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>📊 Latest Test Results</Text>
          <ScrollView style={styles.resultsScroll}>
            <Text style={styles.resultsText}>
              {JSON.stringify(testResults, null, 2)}
            </Text>
          </ScrollView>
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF9800" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle" size={16} color="#666" />
        <Text style={styles.infoText}>
          This tester verifies that push notifications are sent to students and parents 
          when attendance is marked absent. Make sure users have active push tokens registered.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 8,
    color: '#333',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#2196F3',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  resultsScroll: {
    maxHeight: 200,
  },
  resultsText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
    lineHeight: 16,
  },
});

export default AttendanceNotificationTester;