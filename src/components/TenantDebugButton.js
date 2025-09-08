import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTenantContext } from '../contexts/TenantContext';
import { runTenantTest } from '../utils/testTenantFetch';
import { shouldDisplayTenantError, getTenantErrorMessage } from '../utils/TenantErrorUtil';
import { useAuth } from '../utils/AuthContext';

const TenantDebugButton = () => {
  const { 
    currentTenant, 
    tenantId, 
    loading, 
    error, 
    retryTenantLoading 
  } = useTenantContext();
  const { user } = useAuth();
  
  // Only show tenant errors when user is authenticated and error should be displayed
  const shouldShowError = error && shouldDisplayTenantError(error, !!user);
  const displayError = shouldShowError ? getTenantErrorMessage(error) : null;

  const handleDebugInfo = () => {
    const debugInfo = {
      currentTenant: currentTenant ? {
        id: currentTenant.id,
        name: currentTenant.name,
        status: currentTenant.status
      } : null,
      tenantId,
      loading,
      error,
      timestamp: new Date().toISOString()
    };

    console.log('🐛 TENANT DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
    
    Alert.alert(
      'Tenant Debug Info',
      `Tenant ID: ${tenantId || 'NOT SET'}\n` +
      `Tenant Name: ${currentTenant?.name || 'NOT SET'}\n` +
      `Loading: ${loading}\n` +
      `Error: ${error || 'None'}\n\n` +
      'Check console for full details',
      [{ text: 'OK' }]
    );
  };

  const handleRetryLoading = async () => {
    console.log('🔄 Manual retry triggered by debug button');
    try {
      await retryTenantLoading();
      Alert.alert('Success', 'Tenant loading retry completed. Check console for details.');
    } catch (error) {
      console.error('❌ Manual retry failed:', error);
      Alert.alert('Error', `Retry failed: ${error.message}`);
    }
  };

  const handleDatabaseTest = async () => {
    console.log('🧪 Direct database test triggered by debug button');
    try {
      const result = await runTenantTest();
      if (result.success) {
        Alert.alert(
          'Database Test Success',
          `Found tenant: ${result.data.tenant.name}\n` +
          `Status: ${result.data.tenant.status}\n` +
          `User: ${result.data.user.email}\n\n` +
          'Check console for full details.'
        );
      } else {
        Alert.alert(
          'Database Test Failed',
          `Error: ${result.error}\n\n` +
          'Check console for full details.'
        );
      }
    } catch (error) {
      console.error('❌ Database test failed:', error);
      Alert.alert('Error', `Database test failed: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tenant Debug</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          Status: {loading ? 'Loading...' : currentTenant ? '✅ Loaded' : '❌ Not Loaded'}
        </Text>
        {tenantId && (
          <Text style={styles.tenantInfo}>ID: {tenantId.slice(0, 8)}...</Text>
        )}
        {shouldShowError && displayError && (
          <Text style={styles.errorText}>Error: {displayError}</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleDebugInfo}>
          <Text style={styles.buttonText}>Show Debug Info</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.retryButton]} 
          onPress={handleRetryLoading}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading...' : 'Retry Loading'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, styles.testButton]} 
          onPress={handleDatabaseTest}
        >
          <Text style={styles.buttonText}>Test Database</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
    minWidth: 200,
    zIndex: 9999,
  },
  title: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 4,
  },
  tenantInfo: {
    color: 'lightblue',
    fontSize: 11,
    marginBottom: 4,
  },
  errorText: {
    color: 'red',
    fontSize: 11,
    marginBottom: 4,
  },
  buttonContainer: {
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#FF9500',
  },
  testButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default TenantDebugButton;
