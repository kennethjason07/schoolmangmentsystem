/**
 * Startup Loader Component
 * 
 * This component ensures proper synchronization between AuthContext and TenantContext
 * during app startup to prevent "no child for this parent" issues when reopening the app.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../utils/AuthContext';
import { useTenant } from '../contexts/TenantContext';

const StartupLoader = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading, tenantInitialized, initializeTenant } = useTenant();
  const [startupComplete, setStartupComplete] = useState(false);
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  useEffect(() => {
    const handleStartup = async () => {
      console.log('🚀 StartupLoader: Handling app startup synchronization');
      
      // Wait for auth to complete first
      if (authLoading) {
        console.log('🚀 StartupLoader: Waiting for auth to complete...');
        return;
      }

      // If no user, startup is complete (show login screen)
      if (!user) {
        console.log('🚀 StartupLoader: No user found, startup complete');
        setStartupComplete(true);
        return;
      }

      console.log('🚀 StartupLoader: User found:', user.email);

      // If tenant is already initialized, startup is complete
      if (tenantInitialized && currentTenant) {
        console.log('🚀 StartupLoader: Tenant already initialized, startup complete');
        setStartupComplete(true);
        return;
      }

      // If tenant is still loading, wait for it
      if (tenantLoading && !initializationAttempted) {
        console.log('🚀 StartupLoader: Tenant is loading, waiting...');
        return;
      }

      // If tenant initialization hasn't been attempted yet, try to initialize
      if (!tenantInitialized && !tenantLoading && !initializationAttempted) {
        console.log('🚀 StartupLoader: Attempting to initialize tenant...');
        setInitializationAttempted(true);
        
        try {
          const result = await initializeTenant();
          console.log('🚀 StartupLoader: Tenant initialization result:', result.success);
          
          // For parent users, we allow startup to complete even if tenant init fails
          // because parents use direct auth and don't need tenant context for basic operations
          const isParentUser = user.role_id === 3 || user.userType === 'parent';
          
          if (result.success || (result.isAuthError && isParentUser)) {
            console.log('🚀 StartupLoader: Startup can proceed');
            setStartupComplete(true);
          } else if (result.isAuthError) {
            console.log('🚀 StartupLoader: Auth error detected, will retry...');
            // For auth errors, retry after a short delay
            setTimeout(() => {
              setInitializationAttempted(false);
            }, 1000);
          } else {
            console.log('🚀 StartupLoader: Tenant initialization failed, but continuing anyway');
            // Even if tenant init fails, allow the app to continue for parent users
            setStartupComplete(true);
          }
        } catch (error) {
          console.error('🚀 StartupLoader: Error during tenant initialization:', error);
          // Allow startup to complete even on error to prevent app from hanging
          setStartupComplete(true);
        }
      }

      // Safety timeout - ensure startup completes within reasonable time
      const timeoutId = setTimeout(() => {
        console.log('🚀 StartupLoader: Safety timeout reached, forcing startup completion');
        setStartupComplete(true);
      }, 10000); // 10 seconds max

      return () => clearTimeout(timeoutId);
    };

    handleStartup();
  }, [user, authLoading, tenantLoading, tenantInitialized, currentTenant, initializationAttempted, initializeTenant]);

  // Show loading screen during startup
  if (!startupComplete) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
        <Text style={styles.subText}>
          {authLoading ? 'Checking authentication...' : 
           tenantLoading ? 'Loading school data...' : 
           'Initializing app...'}
        </Text>
      </View>
    );
  }

  // Startup complete, render children
  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default StartupLoader;