import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useAuth } from '../../utils/AuthContext';
import { supabase, TABLES, dbHelpers } from '../../utils/supabase';

const TeacherDashboardDebug = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState({});
  const { user } = useAuth();

  const runDiagnostics = async () => {
    try {
      setLoading(true);
      setError(null);
      const diagnostics = {};

      console.log('🔍 Starting TeacherDashboard diagnostics...');
      
      // Test 1: Platform detection
      diagnostics.platform = Platform.OS;
      console.log('Platform:', Platform.OS);

      // Test 2: User authentication
      diagnostics.user = {
        id: user?.id || 'NOT_FOUND',
        email: user?.email || 'NOT_FOUND'
      };
      console.log('User:', diagnostics.user);

      // Test 3: Supabase connection
      try {
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('id')
          .limit(1);
        
        diagnostics.supabase = {
          connected: !testError,
          error: testError?.message || 'OK'
        };
        console.log('Supabase test:', diagnostics.supabase);
      } catch (e) {
        diagnostics.supabase = {
          connected: false,
          error: e.message
        };
      }

      // Test 4: Teacher profile lookup
      if (user?.id) {
        try {
          const teacherResponse = await dbHelpers.getTeacherByUserId(user.id);
          diagnostics.teacher = {
            found: !!teacherResponse.data,
            error: teacherResponse.error?.message || 'OK',
            data: teacherResponse.data ? {
              id: teacherResponse.data.id,
              name: teacherResponse.data.name || teacherResponse.data.full_name
            } : null
          };
          console.log('Teacher lookup:', diagnostics.teacher);
        } catch (e) {
          diagnostics.teacher = {
            found: false,
            error: e.message
          };
        }
      }

      // Test 5: School details
      try {
        const schoolResponse = await dbHelpers.getSchoolDetails();
        diagnostics.school = {
          found: !!schoolResponse.data,
          error: schoolResponse.error?.message || 'OK',
          name: schoolResponse.data?.name || 'NOT_FOUND'
        };
        console.log('School lookup:', diagnostics.school);
      } catch (e) {
        diagnostics.school = {
          found: false,
          error: e.message
        };
      }

      // Test 6: Check critical tables
      const tables = [TABLES.TEACHER_SUBJECTS, TABLES.CLASSES, TABLES.TIMETABLE, TABLES.STUDENTS];
      diagnostics.tables = {};
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);
          
          diagnostics.tables[table] = {
            accessible: !error,
            error: error?.message || 'OK',
            hasData: data && data.length > 0
          };
        } catch (e) {
          diagnostics.tables[table] = {
            accessible: false,
            error: e.message
          };
        }
      }
      console.log('Tables check:', diagnostics.tables);

      setDebugInfo(diagnostics);
      setLoading(false);

    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      setError(error.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      runDiagnostics();
    } else {
      setError('No user authenticated');
      setLoading(false);
    }
  }, [user?.id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 TeacherDashboard Debug</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976d2" />
          <Text style={styles.loadingText}>Running diagnostics...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 TeacherDashboard Debug</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={runDiagnostics}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 TeacherDashboard Debug</Text>
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={runDiagnostics}
          >
            <Ionicons name="refresh" size={20} color="#1976d2" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Information</Text>
            <Text style={styles.infoText}>Platform: {debugInfo.platform}</Text>
            <Text style={styles.infoText}>Running on {Platform.OS === 'web' ? 'Web' : 'Native'}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Authentication</Text>
            <Text style={styles.infoText}>User ID: {debugInfo.user?.id}</Text>
            <Text style={styles.infoText}>Email: {debugInfo.user?.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Supabase Connection</Text>
            <Text style={[styles.infoText, debugInfo.supabase?.connected ? styles.success : styles.error]}>
              Status: {debugInfo.supabase?.connected ? '✅ Connected' : '❌ Failed'}
            </Text>
            {debugInfo.supabase?.error !== 'OK' && (
              <Text style={styles.errorText}>{debugInfo.supabase?.error}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Teacher Profile</Text>
            <Text style={[styles.infoText, debugInfo.teacher?.found ? styles.success : styles.error]}>
              Status: {debugInfo.teacher?.found ? '✅ Found' : '❌ Not Found'}
            </Text>
            {debugInfo.teacher?.data && (
              <>
                <Text style={styles.infoText}>ID: {debugInfo.teacher.data.id}</Text>
                <Text style={styles.infoText}>Name: {debugInfo.teacher.data.name}</Text>
              </>
            )}
            {debugInfo.teacher?.error !== 'OK' && (
              <Text style={styles.errorText}>{debugInfo.teacher?.error}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>School Details</Text>
            <Text style={[styles.infoText, debugInfo.school?.found ? styles.success : styles.error]}>
              Status: {debugInfo.school?.found ? '✅ Found' : '❌ Not Found'}
            </Text>
            {debugInfo.school?.name && (
              <Text style={styles.infoText}>Name: {debugInfo.school.name}</Text>
            )}
            {debugInfo.school?.error !== 'OK' && (
              <Text style={styles.errorText}>{debugInfo.school?.error}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Database Tables</Text>
            {Object.entries(debugInfo.tables || {}).map(([table, info]) => (
              <View key={table} style={styles.tableInfo}>
                <Text style={styles.tableTitle}>{table}</Text>
                <Text style={[styles.infoText, info.accessible ? styles.success : styles.error]}>
                  Access: {info.accessible ? '✅ OK' : '❌ Failed'}
                </Text>
                <Text style={styles.infoText}>
                  Data: {info.hasData ? '✅ Has records' : '⚠️ Empty'}
                </Text>
                {info.error !== 'OK' && (
                  <Text style={styles.errorText}>{info.error}</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                if (navigation) {
                  navigation.navigate('TeacherDashboard');
                } else {
                  Alert.alert('Navigation', 'Navigation object not available');
                }
              }}
            >
              <Text style={styles.actionText}>Try Original Dashboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={() => {
                console.log('🔍 Debug Info:', JSON.stringify(debugInfo, null, 2));
                Alert.alert(
                  'Debug Info', 
                  'Check console for detailed information',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Text style={[styles.actionText, styles.secondaryText]}>Export Debug Info</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1976d2',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    padding: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
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
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  success: {
    color: '#4caf50',
  },
  error: {
    color: '#d32f2f',
  },
  tableInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  tableTitle: {
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  actionButton: {
    backgroundColor: '#1976d2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1976d2',
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryText: {
    color: '#1976d2',
  },
});

export default TeacherDashboardDebug;
