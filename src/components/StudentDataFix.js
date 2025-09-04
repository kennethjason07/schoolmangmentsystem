import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import { AuthFix } from '../utils/authFix';

/**
 * Component to diagnose and fix student data access issues
 * Use this when student details are not loading
 */
const StudentDataFix = ({ onClose }) => {
  const [diagnosisResults, setDiagnosisResults] = useState(null);
  const [isFixing, setIsFixing] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const runDiagnosis = async () => {
    setDiagnosisResults({ loading: true });
    
    try {
      console.log('🔍 Running student data access diagnosis...');
      
      const results = {
        authStatus: null,
        userInfo: null,
        tenantInfo: null,
        studentQuery: null,
        solutions: []
      };

      // Step 1: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        results.authStatus = {
          success: false,
          error: authError?.message || 'No user found',
          issue: 'AUTHENTICATION_MISSING'
        };
        results.solutions.push({
          title: 'Sign In Required',
          description: 'You must be signed in to access student data',
          action: 'signIn',
          priority: 'high'
        });
      } else {
        results.authStatus = {
          success: true,
          email: user.email,
          userId: user.id
        };

        // Check JWT token for tenant_id
        try {
          const payload = JSON.parse(atob(user.access_token.split('.')[1]));
          results.authStatus.tenantId = payload.tenant_id;
          
          if (!payload.tenant_id) {
            results.solutions.push({
              title: 'Missing Tenant ID in Token',
              description: 'Your authentication token lacks tenant information',
              action: 'fixTenant',
              priority: 'high'
            });
          }
        } catch (e) {
          results.solutions.push({
            title: 'Invalid JWT Token',
            description: 'Authentication token is corrupted',
            action: 'refreshToken',
            priority: 'high'
          });
        }

        // Step 2: Check user info in database
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role_id, email, full_name')
            .eq('id', user.id)
            .single();

          if (userError) {
            results.userInfo = {
              success: false,
              error: userError.message,
              issue: 'USER_NOT_IN_DATABASE'
            };
            results.solutions.push({
              title: 'User Not in Database',
              description: 'Your user record is missing from the users table',
              action: 'createUserRecord',
              priority: 'high'
            });
          } else {
            results.userInfo = {
              success: true,
              ...userData
            };

            // Step 3: Check tenant info
            if (userData.tenant_id) {
              const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .select('id, name, status')
                .eq('id', userData.tenant_id)
                .single();

              if (tenantError) {
                results.tenantInfo = {
                  success: false,
                  error: tenantError.message
                };
              } else {
                results.tenantInfo = {
                  success: true,
                  ...tenantData
                };
              }
            }
          }
        } catch (e) {
          results.userInfo = {
            success: false,
            error: e.message,
            issue: 'DATABASE_ERROR'
          };
        }

        // Step 4: Test student query
        try {
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .select('id, name, admission_no, tenant_id')
            .limit(5);

          results.studentQuery = {
            success: !studentError,
            error: studentError?.message,
            count: studentData?.length || 0,
            sampleTenantIds: studentData ? [...new Set(studentData.map(s => s.tenant_id))] : []
          };

          if (studentError) {
            if (studentError.message.includes('permission denied')) {
              results.solutions.push({
                title: 'Permission Denied - RLS Issue',
                description: 'Row Level Security is blocking student data access',
                action: 'fixRLS',
                priority: 'high'
              });
            } else if (studentError.message.includes('relation')) {
              results.solutions.push({
                title: 'Table Missing',
                description: 'Students table does not exist',
                action: 'createTables',
                priority: 'critical'
              });
            }
          } else if (studentData.length === 0) {
            results.solutions.push({
              title: 'No Student Data',
              description: 'No students found in database',
              action: 'addSampleData',
              priority: 'medium'
            });
          }
        } catch (e) {
          results.studentQuery = {
            success: false,
            error: e.message
          };
        }
      }

      // Add general solutions
      if (results.solutions.length === 0) {
        results.solutions.push({
          title: 'No Issues Found',
          description: 'Student data should be accessible',
          action: 'testAgain',
          priority: 'low'
        });
      }

      setDiagnosisResults(results);
      
    } catch (error) {
      console.error('Diagnosis failed:', error);
      setDiagnosisResults({
        error: error.message,
        solutions: [{
          title: 'Diagnosis Failed',
          description: 'Unable to complete diagnosis',
          action: 'tryAgain',
          priority: 'high'
        }]
      });
    }
  };

  const handleFix = async (action) => {
    setIsFixing(true);
    
    try {
      switch (action) {
        case 'signIn':
          Alert.alert(
            'Sign In Required',
            'Please sign out completely and sign in again with valid credentials.',
            [
              { text: 'Cancel' },
              {
                text: 'Sign Out & Sign In',
                onPress: async () => {
                  await AuthFix.forceSignOut();
                  Alert.alert('Signed Out', 'Please sign in again');
                }
              }
            ]
          );
          break;

        case 'fixTenant':
          Alert.alert(
            'Tenant ID Fix',
            'Your authentication token needs to be refreshed to include tenant information. This requires signing out and signing back in.',
            [
              { text: 'Cancel' },
              {
                text: 'Refresh Token',
                onPress: async () => {
                  // Try to refresh the session
                  const { data, error } = await supabase.auth.refreshSession();
                  if (error) {
                    Alert.alert('Refresh Failed', 'Please sign out and sign in again');
                    await AuthFix.forceSignOut();
                  } else {
                    Alert.alert('Success', 'Token refreshed. Please test again.');
                    runDiagnosis();
                  }
                }
              }
            ]
          );
          break;

        case 'refreshToken':
          await AuthFix.forceSignOut();
          Alert.alert('Token Cleared', 'Please sign in again');
          break;

        case 'fixRLS':
          Alert.alert(
            'RLS Fix Required',
            'Row Level Security policies need to be updated. This requires database administrator access. Contact your system administrator to run the fix_student_data_access.sql script.',
            [{ text: 'OK' }]
          );
          break;

        case 'testAgain':
          await testStudentAccess();
          break;

        default:
          Alert.alert('Fix Not Implemented', `The fix for "${action}" is not implemented yet.`);
      }
    } catch (error) {
      console.error('Fix failed:', error);
      Alert.alert('Fix Failed', error.message);
    } finally {
      setIsFixing(false);
    }
  };

  const testStudentAccess = async () => {
    try {
      console.log('🧪 Testing student access...');
      
      // Test 1: Basic student query
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, admission_no')
        .limit(3);

      // Test 2: Student with class info
      const { data: studentsWithClass, error: classError } = await supabase
        .from('students')
        .select(`
          id, name, admission_no,
          classes:class_id (
            id, class_name, section
          )
        `)
        .limit(2);

      // Test 3: Current user info
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userInfo, error: userInfoError } = await supabase
        .from('users')
        .select('tenant_id, role_id')
        .eq('id', user?.id || '')
        .single();

      setTestResults({
        basicQuery: {
          success: !studentsError,
          error: studentsError?.message,
          count: students?.length || 0
        },
        joinQuery: {
          success: !classError,
          error: classError?.message,
          count: studentsWithClass?.length || 0
        },
        userQuery: {
          success: !userInfoError,
          error: userInfoError?.message,
          tenantId: userInfo?.tenant_id
        }
      });

      if (!studentsError && students.length > 0) {
        Alert.alert('Success!', `Found ${students.length} students. Student data is accessible.`);
      } else {
        Alert.alert('Still Issues', studentsError?.message || 'No students found');
      }

    } catch (error) {
      console.error('Test failed:', error);
      setTestResults({ error: error.message });
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#757575';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical': return 'alert-circle';
      case 'high': return 'warning';
      case 'medium': return 'information-circle';
      case 'low': return 'checkmark-circle';
      default: return 'help-circle';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Student Data Access Fix</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <Text style={styles.description}>
        This tool helps diagnose and fix issues when student details are not loading in your application.
      </Text>

      <TouchableOpacity 
        style={styles.diagnosisButton} 
        onPress={runDiagnosis}
      >
        <Ionicons name="search" size={20} color="#fff" />
        <Text style={styles.diagnosisButtonText}>Run Diagnosis</Text>
      </TouchableOpacity>

      {diagnosisResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Diagnosis Results</Text>

          {diagnosisResults.loading && (
            <Text style={styles.loadingText}>Running diagnosis...</Text>
          )}

          {diagnosisResults.authStatus && (
            <View style={styles.resultItem}>
              <Text style={styles.resultTitle}>Authentication Status</Text>
              {diagnosisResults.authStatus.success ? (
                <View style={styles.successResult}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.resultText}>Signed in as {diagnosisResults.authStatus.email}</Text>
                </View>
              ) : (
                <View style={styles.errorResult}>
                  <Ionicons name="close-circle" size={16} color="#f44336" />
                  <Text style={styles.resultText}>{diagnosisResults.authStatus.error}</Text>
                </View>
              )}
            </View>
          )}

          {diagnosisResults.studentQuery && (
            <View style={styles.resultItem}>
              <Text style={styles.resultTitle}>Student Data Query</Text>
              {diagnosisResults.studentQuery.success ? (
                <View style={styles.successResult}>
                  <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
                  <Text style={styles.resultText}>Found {diagnosisResults.studentQuery.count} students</Text>
                </View>
              ) : (
                <View style={styles.errorResult}>
                  <Ionicons name="close-circle" size={16} color="#f44336" />
                  <Text style={styles.resultText}>{diagnosisResults.studentQuery.error}</Text>
                </View>
              )}
            </View>
          )}

          {diagnosisResults.solutions && diagnosisResults.solutions.length > 0 && (
            <View style={styles.solutionsContainer}>
              <Text style={styles.sectionTitle}>Recommended Solutions</Text>
              {diagnosisResults.solutions.map((solution, index) => (
                <View key={index} style={styles.solutionItem}>
                  <View style={styles.solutionHeader}>
                    <Ionicons 
                      name={getPriorityIcon(solution.priority)} 
                      size={20} 
                      color={getPriorityColor(solution.priority)} 
                    />
                    <Text style={styles.solutionTitle}>{solution.title}</Text>
                  </View>
                  <Text style={styles.solutionDescription}>{solution.description}</Text>
                  <TouchableOpacity 
                    style={[styles.fixButton, { backgroundColor: getPriorityColor(solution.priority) }]}
                    onPress={() => handleFix(solution.action)}
                    disabled={isFixing}
                  >
                    <Text style={styles.fixButtonText}>
                      {isFixing ? 'Fixing...' : 'Apply Fix'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity 
        style={styles.testButton} 
        onPress={testStudentAccess}
      >
        <Ionicons name="flask" size={20} color="#fff" />
        <Text style={styles.testButtonText}>Test Student Access</Text>
      </TouchableOpacity>

      {testResults && (
        <View style={styles.testResultsContainer}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          
          <View style={styles.testResult}>
            <Text style={styles.testTitle}>Basic Student Query</Text>
            <View style={testResults.basicQuery.success ? styles.successResult : styles.errorResult}>
              <Ionicons 
                name={testResults.basicQuery.success ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={testResults.basicQuery.success ? "#4caf50" : "#f44336"} 
              />
              <Text style={styles.resultText}>
                {testResults.basicQuery.success 
                  ? `Found ${testResults.basicQuery.count} students` 
                  : testResults.basicQuery.error}
              </Text>
            </View>
          </View>

          <View style={styles.testResult}>
            <Text style={styles.testTitle}>Join Query Test</Text>
            <View style={testResults.joinQuery.success ? styles.successResult : styles.errorResult}>
              <Ionicons 
                name={testResults.joinQuery.success ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={testResults.joinQuery.success ? "#4caf50" : "#f44336"} 
              />
              <Text style={styles.resultText}>
                {testResults.joinQuery.success 
                  ? `Join query successful (${testResults.joinQuery.count} records)` 
                  : testResults.joinQuery.error}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          If issues persist after applying fixes, contact your system administrator.
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  diagnosisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  diagnosisButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loadingText: {
    color: '#666',
    fontStyle: 'italic',
  },
  resultItem: {
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  successResult: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorResult: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  solutionsContainer: {
    marginTop: 16,
  },
  solutionItem: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  solutionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  solutionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  fixButton: {
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  fixButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  testResultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  testResult: {
    marginBottom: 12,
  },
  testTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  footerText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
});

export default StudentDataFix;
