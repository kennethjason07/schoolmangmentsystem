/**
 * 🧪 SIMPLE EXAMS MARKS TEST SCREEN
 * Basic version to test if the screen can render properly
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';
import { useNavigation } from '@react-navigation/native';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../utils/AuthContext';
import { quickTenantCheck, runTenantDataDiagnostics } from '../../utils/tenantDataDiagnostic';

const ExamsMarksTest = () => {
  const navigation = useNavigation();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  const [testResults, setTestResults] = useState(null);

  useEffect(() => {
    console.log('🧪 ExamsMarksTest: Component mounted');
    console.log('📊 Context state:', {
      tenantId: tenantId || 'NOT_SET',
      userId: user?.id || 'NOT_SET',
      userEmail: user?.email || 'NOT_SET'
    });
  }, [tenantId, user]);

  const runQuickTest = async () => {
    try {
      console.log('🔍 Running quick tenant test...');
      const result = await quickTenantCheck();
      setTestResults(result);
      
      Alert.alert(
        'Quick Test Result',
        result.success 
          ? `✅ Success!\nTenant: ${result.tenantName}\nID: ${result.tenantId}`
          : `❌ Failed: ${result.error}`
      );
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      Alert.alert('Test Error', error.message);
    }
  };

  const runFullDiagnostic = async () => {
    try {
      console.log('🩺 Running full diagnostic...');
      const result = await runTenantDataDiagnostics();
      
      Alert.alert(
        'Diagnostic Complete',
        `Tests: ${result.summary.totalTests}\n✅ Passed: ${result.summary.passed}\n❌ Failed: ${result.summary.failed}\n⚠️ Warnings: ${result.summary.warnings}`
      );
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      Alert.alert('Diagnostic Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Exams & Marks (Test)" showBack={true} onBack={() => navigation.goBack()} />
      
      <View style={styles.content}>
        <View style={styles.statusCard}>
          <Ionicons name="information-circle" size={48} color="#2196F3" />
          <Text style={styles.title}>ExamsMarks Test Screen</Text>
          <Text style={styles.subtitle}>Testing tenant context and data loading</Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Current Status:</Text>
          <Text style={styles.infoText}>Tenant ID: {tenantId || 'Not Available'}</Text>
          <Text style={styles.infoText}>User ID: {user?.id || 'Not Available'}</Text>
          <Text style={styles.infoText}>User Email: {user?.email || 'Not Available'}</Text>
        </View>

        {testResults && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>Last Test Result:</Text>
            <Text style={[styles.resultText, { color: testResults.success ? '#4CAF50' : '#F44336' }]}>
              {testResults.success ? '✅ SUCCESS' : '❌ FAILED'}
            </Text>
            <Text style={styles.resultDetails}>
              {testResults.success 
                ? `Tenant: ${testResults.tenantName}`
                : `Error: ${testResults.error}`
              }
            </Text>
          </View>
        )}

        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.testButton} onPress={runQuickTest}>
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.buttonText}>Quick Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.testButton, styles.diagnosticButton]} onPress={runFullDiagnostic}>
            <Ionicons name="medical" size={20} color="#fff" />
            <Text style={styles.buttonText}>Full Diagnostic</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.testButton, styles.originalButton]} 
            onPress={() => navigation.navigate('ExamsMarks')}
          >
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={styles.buttonText}>Open Original Screen</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>
            1. Run "Quick Test" to check tenant context{'\n'}
            2. Run "Full Diagnostic" for comprehensive system check{'\n'}
            3. Check browser console (F12) for detailed logs{'\n'}
            4. Try "Open Original Screen" once tests pass
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  resultsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultDetails: {
    fontSize: 14,
    color: '#666',
  },
  actionsSection: {
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
    marginBottom: 12,
  },
  diagnosticButton: {
    backgroundColor: '#FF9500',
  },
  originalButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  instructionsSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default ExamsMarksTest;
