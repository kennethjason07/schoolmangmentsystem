import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { 
  diagnoseParentStudentRelationships, 
  fixParentStudentRelationships,
  getNotificationReadinessSummary,
  testNotificationForStudent
} from '../../utils/parentNotificationDiagnostic';
import { testParentLookupForStudent } from '../../services/notificationService';

const NotificationDebugScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState(null);
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [fixes, setFixes] = useState([]);

  // Load diagnostic data on screen mount
  useEffect(() => {
    loadDiagnosticData();
  }, []);

  const loadDiagnosticData = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading diagnostic data...');
      
      // Run diagnostic and summary in parallel
      const [diagnosticResult, summaryResult] = await Promise.all([
        diagnoseParentStudentRelationships(),
        getNotificationReadinessSummary()
      ]);

      if (diagnosticResult.success) {
        setDiagnostic(diagnosticResult);
        console.log('✅ Diagnostic loaded:', diagnosticResult.analysis);
      }

      if (summaryResult.success) {
        setSummary(summaryResult.summary);
        console.log('✅ Summary loaded:', summaryResult.summary);
      }

    } catch (error) {
      console.error('❌ Error loading diagnostic data:', error);
      Alert.alert('Error', 'Failed to load diagnostic data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDiagnosticData();
    setRefreshing(false);
  };

  const runAutomaticFixes = async () => {
    Alert.alert(
      'Apply Fixes',
      'This will attempt to fix common parent-student relationship issues. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Apply Fixes', 
          onPress: async () => {
            setLoading(true);
            try {
              const fixResult = await fixParentStudentRelationships();
              if (fixResult.success) {
                setFixes(fixResult.fixes);
                Alert.alert('Fixes Applied', `Applied ${fixResult.fixes.length} fixes successfully!`);
                // Reload data to see changes
                await loadDiagnosticData();
              } else {
                Alert.alert('Error', `Failed to apply fixes: ${fixResult.error}`);
              }
            } catch (error) {
              Alert.alert('Error', `Error applying fixes: ${error.message}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const testNotificationForRandomStudent = async () => {
    if (!summary || summary.ready.length === 0) {
      Alert.alert('No Students Ready', 'No students are ready for notifications. Please fix relationships first.');
      return;
    }

    const randomStudent = summary.ready[Math.floor(Math.random() * summary.ready.length)];
    
    Alert.alert(
      'Test Notification',
      `Send test absence notification for ${randomStudent.studentName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test',
          onPress: async () => {
            setLoading(true);
            try {
              const testResult = await testNotificationForStudent(randomStudent.studentId);
              if (testResult.success) {
                Alert.alert('Success', `Test notification sent to ${testResult.parentName || 'parent'}!`);
              } else {
                Alert.alert('Failed', `Test notification failed: ${testResult.error}`);
              }
            } catch (error) {
              Alert.alert('Error', `Test failed: ${error.message}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const testParentLookup = async (studentId, studentName) => {
    setLoading(true);
    try {
      const result = await testParentLookupForStudent(studentId);
      
      let message;
      if (result.success) {
        message = `Parent found!\nName: ${result.parentName}\nEmail: ${result.parentEmail}\nMethod: ${result.method}`;
      } else {
        message = `No parent found.\nError: ${result.error}`;
      }
      
      Alert.alert(`Parent Lookup for ${studentName}`, message);
    } catch (error) {
      Alert.alert('Error', `Lookup failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !diagnostic && !summary) {
    return (
      <View style={styles.container}>
        <Header title="Notification Debug" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading diagnostic data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Notification Debug" showBack={true} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
      >
        {/* Summary Cards */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Readiness Summary</Text>
            <View style={styles.summaryContainer}>
              <View style={[styles.summaryCard, styles.successCard]}>
                <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
                <Text style={styles.summaryNumber}>{summary.ready.length}</Text>
                <Text style={styles.summaryLabel}>Ready</Text>
              </View>
              <View style={[styles.summaryCard, styles.warningCard]}>
                <Ionicons name="alert-circle" size={32} color="#FF9800" />
                <Text style={styles.summaryNumber}>{summary.notReady.length}</Text>
                <Text style={styles.summaryLabel}>Not Ready</Text>
              </View>
              <View style={[styles.summaryCard, styles.infoCard]}>
                <Ionicons name="people" size={32} color="#2196F3" />
                <Text style={styles.summaryNumber}>{summary.total}</Text>
                <Text style={styles.summaryLabel}>Total Students</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity style={styles.actionButton} onPress={runAutomaticFixes} disabled={loading}>
            <Ionicons name="construct" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Apply Automatic Fixes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.testButton]} onPress={testNotificationForRandomStudent} disabled={loading}>
            <Ionicons name="notifications" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        {/* Applied Fixes */}
        {fixes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Fixes Applied</Text>
            {fixes.map((fix, index) => (
              <View key={index} style={styles.fixItem}>
                <Ionicons 
                  name={fix.startsWith('✅') ? "checkmark-circle" : "close-circle"} 
                  size={16} 
                  color={fix.startsWith('✅') ? "#4CAF50" : "#F44336"} 
                />
                <Text style={styles.fixText}>{fix}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Diagnostic Details */}
        {diagnostic?.analysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Diagnostic Analysis</Text>
            <View style={styles.diagnosticGrid}>
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Students with Parents</Text>
                <Text style={styles.diagnosticValue}>{diagnostic.analysis.studentsWithParents}</Text>
              </View>
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Students without Parents</Text>
                <Text style={styles.diagnosticValue}>{diagnostic.analysis.studentsWithoutParents}</Text>
              </View>
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Parent Users with Links</Text>
                <Text style={styles.diagnosticValue}>{diagnostic.analysis.parentUsersWithLinkedStudents}</Text>
              </View>
              <View style={styles.diagnosticItem}>
                <Text style={styles.diagnosticLabel}>Parent Users without Links</Text>
                <Text style={styles.diagnosticValue}>{diagnostic.analysis.parentUsersWithoutLinkedStudents}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Students Not Ready for Notifications */}
        {summary?.notReady && summary.notReady.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Students Not Ready ({summary.notReady.length})</Text>
            {summary.notReady.slice(0, 10).map((student, index) => (
              <View key={index} style={styles.studentItem}>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.studentName}</Text>
                  <Text style={styles.studentIssues}>{student.issues.join(', ')}</Text>
                </View>
                <TouchableOpacity
                  style={styles.testLookupButton}
                  onPress={() => testParentLookup(student.studentId, student.studentName)}
                >
                  <Ionicons name="search" size={16} color="#2196F3" />
                </TouchableOpacity>
              </View>
            ))}
            {summary.notReady.length > 10 && (
              <Text style={styles.moreText}>... and {summary.notReady.length - 10} more</Text>
            )}
          </View>
        )}

        {/* Students Ready for Notifications */}
        {summary?.ready && summary.ready.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Students Ready ({summary.ready.length})</Text>
            {summary.ready.slice(0, 5).map((student, index) => (
              <View key={index} style={styles.readyStudentItem}>
                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.studentName}</Text>
                  <Text style={styles.parentInfo}>{student.parentName} ({student.parentEmail})</Text>
                </View>
              </View>
            ))}
            {summary.ready.length > 5 && (
              <Text style={styles.moreText}>... and {summary.ready.length - 5} more</Text>
            )}
          </View>
        )}

        {/* Issues Found */}
        {diagnostic?.analysis?.issues && diagnostic.analysis.issues.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Issues Found ({diagnostic.analysis.issues.length})</Text>
            {diagnostic.analysis.issues.slice(0, 10).map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <Ionicons name="warning" size={16} color="#FF9800" />
                <Text style={styles.issueText}>{issue}</Text>
              </View>
            ))}
            {diagnostic.analysis.issues.length > 10 && (
              <Text style={styles.moreText}>... and {diagnostic.analysis.issues.length - 10} more</Text>
            )}
          </View>
        )}

        {/* Recommendations */}
        {diagnostic?.analysis?.recommendations && diagnostic.analysis.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommendations</Text>
            {diagnostic.analysis.recommendations.map((rec, index) => (
              <View key={index} style={styles.recommendationItem}>
                <Ionicons name="lightbulb" size={16} color="#2196F3" />
                <Text style={styles.recommendationText}>{rec}</Text>
              </View>
            ))}
          </View>
        )}
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  successCard: {
    backgroundColor: '#E8F5E8',
  },
  warningCard: {
    backgroundColor: '#FFF8E1',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  diagnosticItem: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  diagnosticLabel: {
    fontSize: 12,
    color: '#666',
  },
  diagnosticValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
  readyStudentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  studentInfo: {
    flex: 1,
    marginLeft: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  studentIssues: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  parentInfo: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  testLookupButton: {
    padding: 8,
  },
  issueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  issueText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recommendationText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
  },
  fixItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  fixText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
  },
  moreText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
});

export default NotificationDebugScreen;
