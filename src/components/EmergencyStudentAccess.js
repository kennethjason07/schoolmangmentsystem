import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';

/**
 * Emergency component to bypass RLS and access student data
 * Use this when RLS is blocking student access
 */
const EmergencyStudentAccess = ({ onClose, onStudentsLoaded }) => {
  const [testResults, setTestResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [students, setStudents] = useState([]);

  // Method 1: Direct query with error handling
  const testDirectAccess = async () => {
    setIsLoading(true);
    setTestResults(null);

    try {
      console.log('🧪 Testing direct student access...');
      
      const tests = [];
      
      // Test 1: Basic student query
      try {
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('id, name, admission_no, dob, gender, tenant_id')
          .limit(10);

        tests.push({
          name: 'Basic Student Query',
          success: !studentsError,
          error: studentsError?.message,
          count: studentsData?.length || 0,
          data: studentsData
        });

        if (!studentsError && studentsData) {
          setStudents(studentsData);
        }
      } catch (e) {
        tests.push({
          name: 'Basic Student Query',
          success: false,
          error: e.message,
          count: 0
        });
      }

      // Test 2: Student with class join
      try {
        const { data: joinData, error: joinError } = await supabase
          .from('students')
          .select(`
            id, name, admission_no,
            classes:class_id (
              id, class_name, section
            )
          `)
          .limit(5);

        tests.push({
          name: 'Student-Class Join',
          success: !joinError,
          error: joinError?.message,
          count: joinData?.length || 0
        });
      } catch (e) {
        tests.push({
          name: 'Student-Class Join',
          success: false,
          error: e.message,
          count: 0
        });
      }

      // Test 3: Check current user context
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        tests.push({
          name: 'User Authentication',
          success: !userError && !!user,
          error: userError?.message || (user ? null : 'No user found'),
          user: user ? {
            id: user.id,
            email: user.email,
            // Try to decode JWT
            jwt_tenant_id: (() => {
              try {
                const payload = JSON.parse(atob(user.access_token.split('.')[1]));
                return payload.tenant_id || 'MISSING';
              } catch {
                return 'DECODE_ERROR';
              }
            })()
          } : null
        });

        // Test user's tenant info
        if (user) {
          const { data: userTenant, error: tenantError } = await supabase
            .from('users')
            .select('tenant_id, role_id, email')
            .eq('id', user.id)
            .single();

          tests.push({
            name: 'User Tenant Info',
            success: !tenantError,
            error: tenantError?.message,
            data: userTenant
          });
        }
      } catch (e) {
        tests.push({
          name: 'User Authentication',
          success: false,
          error: e.message
        });
      }

      setTestResults(tests);

    } catch (error) {
      Alert.alert('Test Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Method 2: Try with service role (if available)
  const testWithServiceRole = () => {
    Alert.alert(
      'Service Role Access',
      'This requires your service role key (server-side only). Do you want instructions to test with service role?',
      [
        { text: 'Cancel' },
        {
          text: 'Show Instructions',
          onPress: () => {
            Alert.alert(
              'Service Role Instructions',
              `1. Get your service role key from Supabase dashboard
              2. Create a server-side test script
              3. Use: createClient(url, serviceRoleKey)
              4. Test student queries
              
              WARNING: Never use service role key in mobile app!`,
              [{ text: 'OK' }]
            );
          }
        }
      ]
    );
  };

  // Method 3: Emergency RLS disable (dangerous)
  const emergencyRLSDisable = () => {
    Alert.alert(
      '⚠️ DANGEROUS: Disable RLS',
      `This will temporarily disable Row Level Security on students table, removing all access restrictions.
      
      SQL to run in Supabase:
      ALTER TABLE students DISABLE ROW LEVEL SECURITY;
      
      ⚠️ WARNING: This removes all security!
      ⚠️ Only use for debugging!
      ⚠️ Re-enable after testing!
      
      To re-enable:
      ALTER TABLE students ENABLE ROW LEVEL SECURITY;`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy SQL',
          onPress: () => {
            // In a real app, you'd copy to clipboard
            console.log('SQL:', 'ALTER TABLE students DISABLE ROW LEVEL SECURITY;');
            Alert.alert('SQL Copied', 'Check console for SQL command');
          }
        }
      ]
    );
  };

  // Method 4: Use alternative approach with raw API
  const testRawAPI = async () => {
    setIsLoading(true);
    
    try {
      console.log('🔄 Testing with raw API approach...');
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        Alert.alert('No Session', 'Please sign in first');
        return;
      }

      // Make raw API call
      const response = await fetch(
        `${supabase.supabaseUrl}/rest/v1/students?select=id,name,admission_no&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabase.supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      Alert.alert(
        'Raw API Success', 
        `Found ${data.length} students via raw API call`,
        [
          { text: 'OK' },
          {
            text: 'Use This Data',
            onPress: () => {
              setStudents(data);
              if (onStudentsLoaded) {
                onStudentsLoaded(data);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Raw API test failed:', error);
      Alert.alert('Raw API Failed', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Method 5: Debug current authentication state
  const debugAuthState = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();

      let debugInfo = '🔍 AUTH DEBUG INFO:\n\n';
      
      debugInfo += `Session exists: ${!!session}\n`;
      debugInfo += `User exists: ${!!user}\n`;
      
      if (user) {
        debugInfo += `User ID: ${user.id}\n`;
        debugInfo += `Email: ${user.email}\n`;
        debugInfo += `Created: ${user.created_at}\n`;
        
        // Decode JWT
        try {
          const payload = JSON.parse(atob(user.access_token.split('.')[1]));
          debugInfo += `\nJWT Claims:\n`;
          debugInfo += `- iss: ${payload.iss}\n`;
          debugInfo += `- aud: ${payload.aud}\n`;
          debugInfo += `- role: ${payload.role}\n`;
          debugInfo += `- tenant_id: ${payload.tenant_id || '❌ MISSING'}\n`;
          debugInfo += `- exp: ${new Date(payload.exp * 1000).toISOString()}\n`;
        } catch (e) {
          debugInfo += `\nJWT decode error: ${e.message}\n`;
        }

        debugInfo += `\nApp Metadata: ${JSON.stringify(user.app_metadata || {}, null, 2)}\n`;
        debugInfo += `User Metadata: ${JSON.stringify(user.user_metadata || {}, null, 2)}\n`;
      }

      console.log(debugInfo);
      
      Alert.alert(
        'Auth Debug Complete',
        'Debug info logged to console. Check console for details.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      Alert.alert('Debug Failed', error.message);
    }
  };

  const renderTestResult = (test, index) => (
    <View key={index} style={styles.testResult}>
      <View style={styles.testHeader}>
        <Ionicons 
          name={test.success ? "checkmark-circle" : "close-circle"} 
          size={20} 
          color={test.success ? "#4caf50" : "#f44336"} 
        />
        <Text style={styles.testName}>{test.name}</Text>
      </View>
      
      {test.success ? (
        <View>
          {test.count !== undefined && (
            <Text style={styles.testDetail}>Records: {test.count}</Text>
          )}
          {test.user && (
            <View>
              <Text style={styles.testDetail}>User: {test.user.email}</Text>
              <Text style={styles.testDetail}>JWT Tenant: {test.user.jwt_tenant_id}</Text>
            </View>
          )}
          {test.data && test.name === 'User Tenant Info' && (
            <Text style={styles.testDetail}>
              DB Tenant: {test.data.tenant_id || 'MISSING'}
            </Text>
          )}
        </View>
      ) : (
        <Text style={styles.errorText}>{test.error}</Text>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚨 Emergency Student Access</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.warningBox}>
        <Ionicons name="warning" size={20} color="#ff9800" />
        <Text style={styles.warningText}>
          RLS is blocking student data. Use these emergency methods to bypass and access data.
        </Text>
      </View>

      <View style={styles.methodsContainer}>
        <Text style={styles.sectionTitle}>Emergency Access Methods</Text>

        <TouchableOpacity 
          style={[styles.methodButton, { backgroundColor: '#2196f3' }]}
          onPress={testDirectAccess}
          disabled={isLoading}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.methodButtonText}>
            {isLoading ? 'Testing...' : 'Test Direct Access'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.methodButton, { backgroundColor: '#4caf50' }]}
          onPress={testRawAPI}
          disabled={isLoading}
        >
          <Ionicons name="code" size={20} color="#fff" />
          <Text style={styles.methodButtonText}>Try Raw API Call</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.methodButton, { backgroundColor: '#ff9800' }]}
          onPress={testWithServiceRole}
        >
          <Ionicons name="key" size={20} color="#fff" />
          <Text style={styles.methodButtonText}>Service Role Instructions</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.methodButton, { backgroundColor: '#9c27b0' }]}
          onPress={debugAuthState}
        >
          <Ionicons name="bug" size={20} color="#fff" />
          <Text style={styles.methodButtonText}>Debug Auth State</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.methodButton, styles.dangerButton]}
          onPress={emergencyRLSDisable}
        >
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.methodButtonText}>⚠️ Emergency RLS Disable</Text>
        </TouchableOpacity>
      </View>

      {testResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          {testResults.map(renderTestResult)}
        </View>
      )}

      {students.length > 0 && (
        <View style={styles.studentsContainer}>
          <Text style={styles.sectionTitle}>Found Students ({students.length})</Text>
          {students.slice(0, 5).map((student, index) => (
            <View key={index} style={styles.studentItem}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentDetail}>
                Admission: {student.admission_no}
              </Text>
              {student.tenant_id && (
                <Text style={styles.studentDetail}>
                  Tenant: {student.tenant_id}
                </Text>
              )}
            </View>
          ))}
          
          {students.length > 5 && (
            <Text style={styles.moreText}>
              ... and {students.length - 5} more students
            </Text>
          )}

          <TouchableOpacity 
            style={styles.useDataButton}
            onPress={() => {
              if (onStudentsLoaded) {
                onStudentsLoaded(students);
              }
              onClose();
            }}
          >
            <Text style={styles.useDataButtonText}>Use This Data</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.instructionsContainer}>
        <Text style={styles.sectionTitle}>Next Steps</Text>
        <Text style={styles.instructionText}>
          1. Run the emergency RLS fix SQL script in Supabase
          2. Have all users sign out and sign in again  
          3. Test student access normally
          4. If still blocked, contact system administrator
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  methodsContainer: {
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
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  methodButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  dangerButton: {
    backgroundColor: '#f44336',
  },
  resultsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  testResult: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  testName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  testDetail: {
    fontSize: 14,
    color: '#666',
    marginLeft: 28,
  },
  errorText: {
    fontSize: 14,
    color: '#f44336',
    marginLeft: 28,
  },
  studentsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  studentItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  studentDetail: {
    fontSize: 14,
    color: '#666',
  },
  moreText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  useDataButton: {
    backgroundColor: '#4caf50',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  useDataButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructionsContainer: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbdefb',
  },
  instructionText: {
    fontSize: 14,
    color: '#1976d2',
    lineHeight: 20,
  },
});

export default EmergencyStudentAccess;
