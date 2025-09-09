import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { 
  debugCurrentUser, 
  debugAllTenants, 
  debugAllStudents, 
  fixUserTenantAssignment, 
  createMissingUserRecord,
  runCompleteDebug 
} from '../../utils/debugTenantSystem';

const DebugTenantScreen = ({ navigation }) => {
  const [debugResults, setDebugResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Run debug on mount
    runDebug();
  }, []);

  const runDebug = async () => {
    setLoading(true);
    try {
      const results = await runCompleteDebug();
      setDebugResults(results);
    } catch (error) {
      Alert.alert('Debug Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixUserIssues = async () => {
    if (!debugResults?.currentUser?.data?.authUser) {
      Alert.alert('Error', 'No authenticated user found');
      return;
    }

    const authUser = debugResults.currentUser.data.authUser;
    
    // Show available tenants for selection
    const tenants = debugResults.allTenants?.data || [];
    const students = debugResults.allStudents?.data || [];
    
    if (tenants.length === 0) {
      Alert.alert('Error', 'No tenants found in the system');
      return;
    }

    // For now, use the first active tenant
    const activeTenant = tenants.find(t => t.status === 'active');
    if (!activeTenant) {
      Alert.alert('Error', 'No active tenant found');
      return;
    }

    // Use first student in the tenant if available
    const tenantStudent = students.find(s => s.tenant_id === activeTenant.id);
    
    Alert.alert(
      'Fix User Assignment',
      `Fix user ${authUser.email}?\n\nTenant: ${activeTenant.name}\nStudent: ${tenantStudent?.name || 'None available'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Fix',
          onPress: async () => {
            setLoading(true);
            try {
              let result;
              
              if (!debugResults.currentUser.data.userRecord) {
                // Create missing user record
                result = await createMissingUserRecord(
                  authUser.id,
                  authUser.email,
                  activeTenant.id,
                  tenantStudent?.id || null
                );
              } else {
                // Fix existing user record
                result = await fixUserTenantAssignment(
                  authUser.email,
                  activeTenant.id,
                  tenantStudent?.id || null
                );
              }
              
              if (result.success) {
                Alert.alert('Success', result.message);
                await runDebug(); // Refresh debug results
              } else {
                Alert.alert('Error', result.error);
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderDebugResult = (title, result) => {
    if (!result) return null;
    
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.status}>
          Status: {result.success ? '✅ Success' : '❌ Failed'}
        </Text>
        {result.error && (
          <Text style={styles.error}>Error: {result.error}</Text>
        )}
        {result.recommendations && (
          <View style={styles.recommendations}>
            <Text style={styles.subTitle}>Recommendations:</Text>
            {result.recommendations.map((rec, index) => (
              <Text key={index} style={styles.recommendation}>
                • {rec}
              </Text>
            ))}
          </View>
        )}
        {result.data && (
          <View style={styles.data}>
            <Text style={styles.subTitle}>Data:</Text>
            <Text style={styles.dataText}>
              {JSON.stringify(result.data, null, 2)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Debug Tenant System</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading && (
          <Text style={styles.loading}>Loading...</Text>
        )}
        
        {debugResults && (
          <View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.button}
                onPress={runDebug}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Refresh Debug</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.fixButton]}
                onPress={fixUserIssues}
                disabled={loading || !debugResults.currentUser?.data?.authUser}
              >
                <Text style={styles.buttonText}>Fix User Issues</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.summary}>
              <Text style={styles.sectionTitle}>Summary</Text>
              {debugResults.summary?.map((item, index) => (
                <Text key={index} style={styles.summaryItem}>• {item}</Text>
              ))}
            </View>

            {renderDebugResult('Current User', debugResults.currentUser)}
            {renderDebugResult('All Tenants', debugResults.allTenants)}
            {renderDebugResult('All Students', debugResults.allStudents)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loading: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fixButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  summary: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryItem: {
    fontSize: 14,
    marginVertical: 2,
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
    marginTop: 8,
  },
  status: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  error: {
    fontSize: 14,
    color: '#F44336',
    marginBottom: 8,
  },
  recommendations: {
    marginTop: 8,
  },
  recommendation: {
    fontSize: 14,
    color: '#666',
    marginVertical: 2,
  },
  data: {
    marginTop: 8,
  },
  dataText: {
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    color: '#333',
  },
});

export default DebugTenantScreen;
