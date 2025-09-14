/**
 * 🛡️ TENANT ERROR BOUNDARY & FALLBACK UI
 * Provides error handling and fallback UI for tenant context loading issues
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { runTenantDataDiagnostics, quickTenantCheck } from '../utils/tenantDataDiagnostic';

/**
 * TenantLoadingFallback - Displays when tenant context is loading or failed
 */
export const TenantLoadingFallback = ({
  loading = true,
  error = null,
  onRetry = null,
  onDiagnostic = null,
  showDiagnosticButton = true,
  title = "Loading System Data",
  message = "Please wait while we load your school data..."
}) => {
  const [retrying, setRetrying] = useState(false);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);

  const handleRetry = async () => {
    if (onRetry && !retrying) {
      setRetrying(true);
      try {
        await onRetry();
      } catch (error) {
        console.error('❌ Retry failed:', error);
      } finally {
        setRetrying(false);
      }
    }
  };

  const handleDiagnostic = async () => {
    if (diagnosticRunning) return;

    setDiagnosticRunning(true);
    try {
      console.log('🩺 Running diagnostic from TenantLoadingFallback...');
      
      if (onDiagnostic) {
        await onDiagnostic();
      } else {
        // Run default diagnostic
        const result = await runTenantDataDiagnostics();
        
        // Show summary to user
        Alert.alert(
          'Diagnostic Complete',
          `Tests: ${result.summary.totalTests}\n✅ Passed: ${result.summary.passed}\n❌ Failed: ${result.summary.failed}\n⚠️ Warnings: ${result.summary.warnings}\n\nCheck console for detailed report.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      Alert.alert('Diagnostic Error', `Failed to run diagnostic: ${error.message}`);
    } finally {
      setDiagnosticRunning(false);
    }
  };

  const handleQuickCheck = async () => {
    console.log('🔍 Running quick tenant check...');
    const result = await quickTenantCheck();
    
    Alert.alert(
      'Quick Check Result',
      result.success 
        ? `✅ Success!\nTenant: ${result.tenantName}\nID: ${result.tenantId}\nHas Data: ${result.hasData ? 'Yes' : 'No'}`
        : `❌ Failed: ${result.error}\nStep: ${result.step}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          {loading && !error ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <Ionicons 
              name={error ? "warning-outline" : "school-outline"} 
              size={64} 
              color={error ? "#FF6B6B" : "#007AFF"} 
            />
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {error ? "System Error" : title}
        </Text>

        {/* Message */}
        <Text style={styles.message}>
          {error || message}
        </Text>

        {/* Loading indicator */}
        {loading && !error && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Initializing...</Text>
          </View>
        )}

        {/* Error actions */}
        {error && (
          <View style={styles.actionContainer}>
            {/* Retry button */}
            {onRetry && (
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]} 
                onPress={handleRetry}
                disabled={retrying}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Retry</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Quick check button */}
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={handleQuickCheck}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="flash-outline" size={20} color="#007AFF" />
                <Text style={styles.secondaryButtonText}>Quick Check</Text>
              </View>
            </TouchableOpacity>

            {/* Diagnostic button */}
            {showDiagnosticButton && (
              <TouchableOpacity 
                style={[styles.button, styles.diagnosticButton]} 
                onPress={handleDiagnostic}
                disabled={diagnosticRunning}
              >
                {diagnosticRunning ? (
                  <ActivityIndicator size="small" color="#FF9500" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name="medical-outline" size={20} color="#FF9500" />
                    <Text style={styles.diagnosticButtonText}>Run Diagnostic</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Help text */}
        <View style={styles.helpContainer}>
          <Text style={styles.helpText}>
            {error 
              ? "If the problem persists, try logging out and back in, or contact support."
              : "This may take a moment on first load."
            }
          </Text>
        </View>
      </View>
    </View>
  );
};

/**
 * TenantContextProvider - Wraps components to provide fallback UI for tenant issues
 */
export const TenantContextProvider = ({ 
  children, 
  fallbackProps = {},
  enableMonitoring = true 
}) => {
  const [tenantState, setTenantState] = useState({
    loading: true,
    error: null,
    retryCount: 0
  });

  const [contextCheck, setContextCheck] = useState(null);

  // Monitor tenant context
  useEffect(() => {
    let mounted = true;
    let checkInterval;

    const checkTenantContext = async () => {
      try {
        const result = await quickTenantCheck();
        
        if (!mounted) return;

        if (result.success) {
          setTenantState({
            loading: false,
            error: null,
            retryCount: 0
          });
          setContextCheck(result);
        } else {
          // Only show error if it's not an auth issue (user might be on login screen)
          if (result.step !== 'auth') {
            setTenantState(prev => ({
              loading: false,
              error: `System not ready: ${result.error}`,
              retryCount: prev.retryCount
            }));
          } else {
            // For auth issues, just keep loading state
            setTenantState(prev => ({
              ...prev,
              loading: true,
              error: null
            }));
          }
          setContextCheck(result);
        }
      } catch (error) {
        if (!mounted) return;
        
        setTenantState(prev => ({
          loading: false,
          error: `Context check failed: ${error.message}`,
          retryCount: prev.retryCount
        }));
      }
    };

    // Initial check
    checkTenantContext();

    // Set up periodic monitoring if enabled
    if (enableMonitoring) {
      checkInterval = setInterval(checkTenantContext, 3000);
    }

    return () => {
      mounted = false;
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, [enableMonitoring]);

  const handleRetry = async () => {
    setTenantState(prev => ({
      loading: true,
      error: null,
      retryCount: prev.retryCount + 1
    }));

    // Wait a moment then recheck
    setTimeout(async () => {
      const result = await quickTenantCheck();
      
      if (result.success) {
        setTenantState({
          loading: false,
          error: null,
          retryCount: 0
        });
      } else {
        setTenantState(prev => ({
          loading: false,
          error: `Retry ${prev.retryCount} failed: ${result.error}`,
          retryCount: prev.retryCount
        }));
      }
    }, 1000);
  };

  // Show fallback UI if there are issues (but not for auth errors on login screen)
  if (tenantState.error || (tenantState.loading && tenantState.retryCount > 0)) {
    return (
      <TenantLoadingFallback
        loading={tenantState.loading}
        error={tenantState.error}
        onRetry={handleRetry}
        {...fallbackProps}
      />
    );
  }

  // Show loading state for initial context check
  if (tenantState.loading && !contextCheck) {
    return (
      <TenantLoadingFallback
        loading={true}
        error={null}
        title="Starting App"
        message="Initializing school management system..."
        showDiagnosticButton={false}
        {...fallbackProps}
      />
    );
  }

  return children;
};

/**
 * Hook to use tenant context state
 */
export const useTenantContextState = () => {
  const [contextState, setContextState] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkContext = async () => {
      const result = await quickTenantCheck();
      if (mounted) {
        setContextState(result);
      }
    };

    checkContext();

    return () => {
      mounted = false;
    };
  }, []);

  return contextState;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA'
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
    width: '100%'
  },
  iconContainer: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24
  },
  loadingContainer: {
    marginTop: 16
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center'
  },
  actionContainer: {
    width: '100%',
    gap: 12
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44
  },
  primaryButton: {
    backgroundColor: '#007AFF'
  },
  secondaryButton: {
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#007AFF'
  },
  diagnosticButton: {
    backgroundColor: '#FFF5E6',
    borderWidth: 1,
    borderColor: '#FF9500'
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF'
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF'
  },
  diagnosticButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500'
  },
  helpContainer: {
    marginTop: 24,
    paddingHorizontal: 16
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20
  }
});

export default TenantLoadingFallback;
