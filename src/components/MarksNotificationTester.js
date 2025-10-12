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
  createGradeNotification, 
  findParentUsersForStudents,
  findStudentUsersForStudents,
  getActivePushTokensForUser
} from '../utils/gradeNotificationHelpers';
import { supabase, TABLES } from '../utils/supabase';

const MarksNotificationTester = () => {
  const { user } = useAuth();
  const { getTenantId } = useTenantAccess();
  const [loading, setLoading] = useState(false);
  const [testData, setTestData] = useState({
    classes: [],
    subjects: [],
    exams: [],
    students: []
  });
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const [testResults, setTestResults] = useState(null);

  // Load test data for marks notifications
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

      // Load exams
      const { data: examsData, error: examsError } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name, start_date, end_date, max_marks')
        .eq('tenant_id', tenantId)
        .limit(3);

      if (examsError) throw examsError;

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
        exams: examsData || [],
        students: studentsData
      });

      // Set defaults
      if (classesData && classesData.length > 0) setSelectedClass(classesData[0].id);
      if (subjectsData.length > 0) setSelectedSubject(subjectsData[0].id);
      if (examsData && examsData.length > 0) setSelectedExam(examsData[0].id);

      console.log('📚 Loaded test data:', {
        classes: classesData?.length || 0,
        subjects: subjectsData.length,
        exams: examsData?.length || 0,
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

  // Test marks notification for selected class, subject, exam
  const testMarksNotification = async () => {
    try {
      setLoading(true);
      setTestResults(null);
      
      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      if (!selectedClass || !selectedSubject || !selectedExam) {
        throw new Error('Please load test data first and ensure class, subject, and exam are selected');
      }

      const studentIds = testData.students.slice(0, 3).map(s => s.id); // Test with first 3 students

      if (studentIds.length === 0) {
        throw new Error('No students available for testing');
      }

      console.log('🧪 Testing marks notification for:', {
        classId: selectedClass,
        subjectId: selectedSubject,
        examId: selectedExam,
        studentIds: studentIds
      });

      // Check for parent and student users before sending
      const { parentUsers } = await findParentUsersForStudents(studentIds, tenantId);
      const { studentUsers } = await findStudentUsersForStudents(studentIds, tenantId);

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

      // Create the marks notification (this will send push notifications)
      const result = await createGradeNotification({
        classId: selectedClass,
        subjectId: selectedSubject,
        examId: selectedExam,
        teacherId: user.id,
        studentIds: studentIds,
        tenantId: tenantId
      });

      const testResult = {
        selectedData: {
          className: testData.classes.find(c => c.id === selectedClass)?.class_name || 'Unknown',
          subjectName: testData.subjects.find(s => s.id === selectedSubject)?.name || 'Unknown',
          examName: testData.exams.find(e => e.id === selectedExam)?.name || 'Unknown',
          studentsCount: studentIds.length
        },
        parentUsers: parentUsers.length,
        studentUsers: studentUsers.length,
        pushTokenResults,
        notificationResult: result,
        timestamp: new Date().toLocaleString()
      };

      setTestResults(testResult);

      const message = `Test completed:\n\n` +
        `• Class: ${testResult.selectedData.className}\n` +
        `• Subject: ${testResult.selectedData.subjectName}\n` +
        `• Exam: ${testResult.selectedData.examName}\n` +
        `• Students: ${testResult.selectedData.studentsCount}\n\n` +
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
      console.error('Error testing marks notification:', error);
      if (Platform.OS === 'web') {
        window.alert(`Test failed: ${error.message}`);
      } else {
        Alert.alert('Test Failed', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick test with mock data
  const runQuickTest = async () => {
    try {
      setLoading(true);
      setTestResults(null);

      const tenantId = getTenantId();
      if (!tenantId) {
        throw new Error('No tenant context available');
      }

      // Get any available class, subject, exam from database
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

      const { data: quickExam } = await supabase
        .from(TABLES.EXAMS)
        .select('id, name')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      const { data: quickStudents } = await supabase
        .from(TABLES.STUDENTS)
        .select('id, name')
        .eq('class_id', quickClass.id)
        .eq('tenant_id', tenantId)
        .limit(2);

      if (!quickSubject || !quickExam || !quickStudents || quickStudents.length === 0) {
        throw new Error('Insufficient test data available (need class, subject, exam, and students)');
      }

      const result = await createGradeNotification({
        classId: quickClass.id,
        subjectId: quickSubject.id,
        examId: quickExam.id,
        teacherId: user.id,
        studentIds: quickStudents.map(s => s.id),
        tenantId: tenantId
      });

      const summary = {
        className: quickClass.class_name,
        subjectName: quickSubject.name,
        examName: quickExam.name,
        studentsCount: quickStudents.length,
        success: result.success,
        totalRecipients: result.recipientCount,
        pushNotifications: result.pushNotificationResults?.successfulPushCount || 0
      };

      const message = `Quick Test Results:\n\n` +
        `• ${summary.className} - ${summary.subjectName}\n` +
        `• ${summary.examName}\n` +
        `• ${summary.studentsCount} students\n` +
        `• ${summary.totalRecipients} recipients\n` +
        `• ${summary.pushNotifications} push notifications sent\n` +
        `• Status: ${summary.success ? 'Success' : 'Failed'}`;

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Quick Test Results', message);
      }

      setTestResults({ quickTest: true, summary });

    } catch (error) {
      console.error('Error in quick test:', error);
      Alert.alert('Quick Test Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="school" size={24} color="#4CAF50" />
        <Text style={styles.title}>Marks Notification Tester</Text>
      </View>

      <Text style={styles.description}>
        Test push notifications for marks entry to students and parents when teachers add exam marks.
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
            Load Classes, Subjects, Exams ({testData.classes.length} classes loaded)
          </Text>
        </TouchableOpacity>
      </View>

      {testData.classes.length > 0 && (
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
              • Exam: {testData.exams.find(e => e.id === selectedExam)?.name || 'None'}
            </Text>
          </View>
        </View>
      )}

      {testData.classes.length > 0 && selectedClass && selectedSubject && selectedExam && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Run Tests</Text>
          <TouchableOpacity 
            style={[styles.button, styles.successButton]} 
            onPress={testMarksNotification}
            disabled={loading}
          >
            <Ionicons name="flask" size={16} color="#fff" />
            <Text style={styles.buttonText}>
              Test Marks Notifications (Detailed)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ Quick Test</Text>
        <TouchableOpacity 
          style={[styles.button, styles.warningButton]} 
          onPress={runQuickTest}
          disabled={loading}
        >
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.buttonText}>
            Quick Test (Auto-select data)
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
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Running test...</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <Ionicons name="information-circle" size={16} color="#666" />
        <Text style={styles.infoText}>
          This tester verifies that push notifications are sent to students and parents 
          when teachers enter marks. Both in-app and push notifications should be delivered 
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
    backgroundColor: '#4CAF50',
  },
  successButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
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
    backgroundColor: '#e8f5e8',
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

export default MarksNotificationTester;