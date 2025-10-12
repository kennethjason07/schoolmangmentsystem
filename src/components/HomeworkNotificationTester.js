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
  createHomeworkNotification, 
  findParentUsersForHomework,
  findStudentUsersForHomework,
  getActivePushTokensForUser,
  getHomeworkNotificationContext
} from '../utils/homeworkNotificationHelpers';
import { supabase, TABLES } from '../utils/supabase';

const HomeworkNotificationTester = () => {
  const { user } = useAuth();
  const { getTenantId } = useTenantAccess();
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState({
    classes: [],
    subjects: [],
    homework: [],
    students: []
  });
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [testResults, setTestResults] = useState(null);

  // Load test data for homework notifications
  const loadTestData = async () => {
    try {
      setLoading(true);
      const tenantId = getTenantId();
      
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      // Load classes
      const { data: classesData, error: classesError } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name, section')
        .eq('tenant_id', tenantId)
        .limit(5);

      if (classesError) throw classesError;

      // Load subjects for first class if available
      let subjectsData = [];
      if (classesData && classesData.length > 0) {
        const { data: subjects, error: subjectsError } = await supabase
          .from(TABLES.SUBJECTS)
          .select('id, name, class_id')
          .eq('class_id', classesData[0].id)
          .eq('tenant_id', tenantId)
          .limit(3);

        if (!subjectsError) {
          subjectsData = subjects || [];
        }
      }

      // Load existing homework
      const { data: homeworkData, error: homeworkError } = await supabase
        .from(TABLES.HOMEWORKS)
        .select(`
          id,
          title,
          description,
          due_date,
          class_id,
          subject_id,
          teacher_id,
          assigned_students,
          classes(class_name, section),
          subjects(name)
        `)
        .eq('tenant_id', tenantId)
        .limit(5);

      if (homeworkError) throw homeworkError;

      // Load students for first class if available
      let studentsData = [];
      if (classesData && classesData.length > 0) {
        const { data: students, error: studentsError } = await supabase
          .from(TABLES.STUDENTS)
          .select(`
            id,
            name,
            roll_no,
            class_id,
            classes(class_name, section)
          `)
          .eq('class_id', classesData[0].id)
          .eq('tenant_id', tenantId)
          .limit(5);

        if (!studentsError) {
          studentsData = students || [];
        }
      }

      setTestData({
        classes: classesData || [],
        subjects: subjectsData,
        homework: homeworkData || [],
        students: studentsData
      });

      // Set defaults
      if (classesData && classesData.length > 0) setSelectedClass(classesData[0].id);
      if (subjectsData.length > 0) setSelectedSubject(subjectsData[0].id);
      if (homeworkData && homeworkData.length > 0) setSelectedHomework(homeworkData[0].id);

      console.log('📚 Loaded homework test data:', {
        classes: classesData?.length || 0,
        subjects: subjectsData.length,
        homework: homeworkData?.length || 0,
        students: studentsData.length
      });
      
    } catch (error) {
      console.error('Error loading test data:', error);
      if (Platform.OS === 'web') {
        window.alert(`Error loading test data: ${error.message}`);
      } else {
        Alert.alert('Error', `Error loading test data: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Test homework notification for selected homework
  const testHomeworkNotification = async () => {
    try {
      setLoading(true);
      setTestResults(null);
      
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      if (!selectedHomework) {
        throw new Error('Please load test data first and ensure homework is selected');
      }

      const homework = testData.homework.find(h => h.id === selectedHomework);
      if (!homework) {
        throw new Error('Selected homework not found');
      }

      // Get assigned students or all students in class
      let studentIds = homework.assigned_students || [];
      if (studentIds.length === 0 && selectedClass) {
        studentIds = testData.students.map(s => s.id);
      }

      if (studentIds.length === 0) {
        throw new Error('No students available for testing');
      }

      console.log('🧪 Testing homework notification for:', {
        homeworkId: selectedHomework,
        homeworkTitle: homework.title,
        classId: homework.class_id,
        subjectId: homework.subject_id,
        studentIds: studentIds
      });

      // Check for parent and student users before sending
      const { parentUsers } = await findParentUsersForHomework(studentIds, tenantId);
      const { studentUsers } = await findStudentUsersForHomework(studentIds, tenantId);

      // Check push tokens for all users
      const pushTokenResults = [];
      
      for (const parent of parentUsers) {
        const tokens = await getActivePushTokensForUser(parent.id, tenantId);
        pushTokenResults.push({
          userType: 'parent',
          email: parent.email,
          name: parent.full_name || 'Unknown',
          tokenCount: tokens.length
        });
      }
      
      for (const student of studentUsers) {
        const tokens = await getActivePushTokensForUser(student.id, tenantId);
        pushTokenResults.push({
          userType: 'student',
          email: student.email,
          name: student.full_name || 'Unknown',
          tokenCount: tokens.length
        });
      }

      // Create the homework notification (this will send push notifications)
      const result = await createHomeworkNotification({
        homeworkId: selectedHomework,
        classId: homework.class_id,
        subjectId: homework.subject_id,
        teacherId: homework.teacher_id,
        assignedStudents: studentIds,
        tenantId: tenantId
      });

      const testResult = {
        homework: {
          title: homework.title,
          className: homework.classes?.class_name || 'Unknown',
          subjectName: homework.subjects?.name || 'Unknown',
          studentsCount: studentIds.length,
          dueDate: homework.due_date
        },
        parentUsers: parentUsers.length,
        studentUsers: studentUsers.length,
        pushTokenResults,
        notificationResult: result,
        timestamp: new Date().toLocaleString()
      };

      setTestResults(testResult);

      const message = `Test completed for "${homework.title}":\n\n` +
        `• Class: ${testResult.homework.className}\n` +
        `• Subject: ${testResult.homework.subjectName}\n` +
        `• Students: ${testResult.homework.studentsCount}\n\n` +
        `• Parent users found: ${parentUsers.length}\n` +
        `• Student users found: ${studentUsers.length}\n` +
        `• Push notifications sent: ${result.pushNotificationResults?.successfulPushCount || 0}/${result.pushNotificationResults?.totalUsers || 0}\n` +
        `• In-app notifications: ${result.success ? 'Success' : 'Failed'}\n` +
        `• Total recipients: ${result.recipientCount || 0}`;

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Test Results', message);
      }

      console.log('🧪 Test results:', testResult);
      
    } catch (error) {
      console.error('Error testing homework notification:', error);
      if (Platform.OS === 'web') {
        window.alert(`Test failed: ${error.message}`);
      } else {
        Alert.alert('Test Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Create mock homework and test notification
  const testWithMockHomework = async () => {
    try {
      setLoading(true);
      setTestResults(null);

      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      // Get any available class, subject from database
      const { data: quickClass } = await supabase
        .from(TABLES.CLASSES)
        .select('id, class_name')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      if (!quickClass) {
        throw new Error('No classes found for testing');
      }

      const { data: quickSubject } = await supabase
        .from(TABLES.SUBJECTS)
        .select('id, name')
        .eq('class_id', quickClass.id)
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      const { data: quickStudents } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name')
        .eq('class_id', quickClass.id)
        .eq('tenant_id', tenantId)
        .limit(3);

      if (!quickSubject || !quickStudents || quickStudents.length === 0) {
        throw new Error('Insufficient test data available (need class, subject, and students)');
      }

      // Create a mock homework entry for testing
      const mockHomework = {
        title: 'Test Homework - Math Practice',
        description: 'This is a test homework assignment for push notification testing.',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        class_id: quickClass.id,
        subject_id: quickSubject.id,
        teacher_id: user.id,
        assigned_students: quickStudents.map(s => s.id),
        tenant_id: tenantId
      };

      const { data: createdHomework, error: homeworkError } = await supabase
        .from(TABLES.HOMEWORKS)
        .insert(mockHomework)
        .select()
        .single();

      if (homeworkError) {
        throw new Error(`Failed to create mock homework: ${homeworkError.message}`);
      }

      console.log('📝 Created mock homework for testing:', createdHomework.id);

      // Now test the notification
      const result = await createHomeworkNotification({
        homeworkId: createdHomework.id,
        classId: quickClass.id,
        subjectId: quickSubject.id,
        teacherId: user.id,
        assignedStudents: quickStudents.map(s => s.id),
        tenantId: tenantId
      });

      const summary = {
        homeworkTitle: mockHomework.title,
        className: quickClass.class_name,
        subjectName: quickSubject.name,
        studentsCount: quickStudents.length,
        success: result.success,
        totalRecipients: result.recipientCount,
        pushNotifications: result.pushNotificationResults?.successfulPushCount || 0
      };

      const message = `Mock Homework Test Results:\n\n` +
        `• "${summary.homeworkTitle}"\n` +
        `• ${summary.className} - ${summary.subjectName}\n` +
        `• ${summary.studentsCount} students\n` +
        `• ${summary.totalRecipients} recipients\n` +
        `• ${summary.pushNotifications} push notifications sent\n` +
        `• Status: ${summary.success ? 'Success' : 'Failed'}`;

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Mock Test Results', message);
      }

      setTestResults({ mockTest: true, summary, homeworkId: createdHomework.id });

    } catch (error) {
      console.error('Error in mock homework test:', error);
      Alert.alert('Mock Test Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="book" size={24} color="#9C27B0" />
        <Text style={styles.title}>Homework Notification Tester</Text>
      </View>

      <Text style={styles.description}>
        Test push notifications for homework uploads to students and parents when teachers assign homework.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📚 Load Test Data</Text>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={loadTestData}
          disabled={loading}
        >
          <Ionicons name="download" size={16} color="#fff" />
          <Text style={styles.buttonText}>
            Load Homework Data ({testData.homework.length} homework loaded)
          </Text>
        </TouchableOpacity>
      </View>

      {testData.homework.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Test Configuration</Text>
          <View style={styles.configContainer}>
            <Text style={styles.configText}>
              • Class: {testData.classes.find(c => c.id === selectedClass)?.class_name || 'None'} ({testData.students.length} students)
            </Text>
            <Text style={styles.configText}>
              • Subject: {testData.subjects.find(s => s.id === selectedSubject)?.name || 'None'}
            </Text>
            <Text style={styles.configText}>
              • Homework: {testData.homework.find(h => h.id === selectedHomework)?.title || 'None'}
            </Text>
          </View>
        </View>
      )}

      {testData.homework.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Available Homework</Text>
          {testData.homework.slice(0, 3).map((homework, index) => (
            <TouchableOpacity
              key={homework.id}
              style={[styles.button, styles.homeworkButton, selectedHomework === homework.id && styles.selectedButton]}
              onPress={() => setSelectedHomework(homework.id)}
              disabled={loading}
            >
              <Ionicons name={selectedHomework === homework.id ? "checkmark-circle" : "document"} size={16} color={selectedHomework === homework.id ? "#4CAF50" : "#9C27B0"} />
              <Text style={[styles.homeworkButtonText, selectedHomework === homework.id && styles.selectedButtonText]}>
                {homework.title} ({homework.subjects?.name || 'Unknown Subject'})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedHomework && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Run Tests</Text>
          <TouchableOpacity 
            style={[styles.button, styles.successButton]} 
            onPress={testHomeworkNotification}
            disabled={loading}
          >
            <Ionicons name="flask" size={16} color="#fff" />
            <Text style={styles.buttonText}>
              Test Selected Homework Notifications
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Mock Test</Text>
        <TouchableOpacity 
          style={[styles.button, styles.warningButton]} 
          onPress={testWithMockHomework}
          disabled={loading}
        >
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.buttonText}>
            Create Mock Homework & Test
          </Text>
        </TouchableOpacity>
      </View>

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
          <ActivityIndicator size="large" color="#9C27B0" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle" size={16} color="#666" />
        <Text style={styles.infoText}>
          This tester verifies that push notifications are sent to students and parents 
          when teachers upload homework assignments. Both in-app and push notifications should be delivered 
          with appropriate content for each user type.
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
  configContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  configText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
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
    backgroundColor: '#9C27B0',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  homeworkButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#9C27B0',
    justifyContent: 'flex-start',
  },
  selectedButton: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  homeworkButtonText: {
    color: '#9C27B0',
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  selectedButtonText: {
    color: '#4CAF50',
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
    backgroundColor: '#f3e5f5',
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

export default HomeworkNotificationTester;