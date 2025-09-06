import React, { useEffect, useState } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Only essential imports for initial load
import WebPerformanceMonitor from './src/components/WebPerformanceMonitor';
import { LoginScreen } from './src/navigation/LazyScreens';

// Defer all heavy imports
let TenantProvider, AuthProvider, SelectedStudentProvider, AppNavigator;

const LoadingSpinner = () => (
  <View style={{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  }}>
    <ActivityIndicator size="large" color="#2196F3" />
    <Text style={{ marginTop: 10, fontSize: 16, color: '#666' }}>
      Loading VidyaSetu...
    </Text>
  </View>
);

export default function App() {
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(null);

  useEffect(() => {
    const loadComponents = async () => {
      try {
        console.log('🚀 Starting minimal load...');
        const startTime = Date.now();

        // Load components in order of importance
        const [
          { TenantProvider: TenantProviderModule },
          { AuthProvider: AuthProviderModule },
          { SelectedStudentProvider: SelectedStudentProviderModule },
          AppNavigatorModule
        ] = await Promise.all([
          import('./src/contexts/TenantContext'),
          import('./src/utils/AuthContext'),
          import('./src/contexts/SelectedStudentContext'),
          Platform.OS === 'web' 
            ? import('./src/navigation/AppNavigator.optimized')
            : import('./src/navigation/AppNavigator')
        ]);

        TenantProvider = TenantProviderModule;
        AuthProvider = AuthProviderModule;
        SelectedStudentProvider = SelectedStudentProviderModule;
        AppNavigator = AppNavigatorModule.default;

        const loadTime = Date.now() - startTime;
        console.log(`✅ Components loaded in ${loadTime}ms`);
        
        setComponentsLoaded(true);

        // Load diagnostics after UI is ready (web optimization)
        if (Platform.OS !== 'web') {
          setTimeout(async () => {
            try {
              const [networkDiag, roleInterceptor] = await Promise.all([
                import('./src/utils/networkDiagnostics'),
                import('./src/utils/roleIdInterceptor')
              ]);
              networkDiag.runNetworkDiagnostics();
              roleInterceptor.enableRoleIdInterceptor();
            } catch (error) {
              console.warn('Non-critical diagnostics failed:', error);
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Failed to load components:', error);
        setLoadingError(error);
        setComponentsLoaded(true); // Show something even if there's an error
      }
    };

    loadComponents();
  }, []);

  if (loadingError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', textAlign: 'center', marginBottom: 20 }}>
          Failed to load application components
        </Text>
        <Text style={{ color: '#666', textAlign: 'center', fontSize: 12 }}>
          {loadingError.message}
        </Text>
      </View>
    );
  }

  if (!componentsLoaded) {
    return (
      <SafeAreaProvider>
        <WebPerformanceMonitor>
          <LoadingSpinner />
        </WebPerformanceMonitor>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <WebPerformanceMonitor>
        <TenantProvider>
          <AuthProvider>
            <SelectedStudentProvider>
              <AppNavigator />
              <StatusBar style="auto" />
            </SelectedStudentProvider>
          </AuthProvider>
        </TenantProvider>
      </WebPerformanceMonitor>
    </SafeAreaProvider>
  );
}
