import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TenantProvider } from './src/contexts/TenantContext';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import WebPerformanceMonitor from './src/components/WebPerformanceMonitor';

// Conditionally import AppNavigator
const AppNavigator = Platform.OS === 'web' 
  ? React.lazy(() => import('./src/navigation/AppNavigator.optimized'))
  : require('./src/navigation/AppNavigator').default;

// Conditionally run diagnostics (skip heavy operations on web)
const runDiagnostics = () => {
  if (Platform.OS === 'web') {
    console.log('🌐 Web platform detected - skipping heavy diagnostics');
    return;
  }
  
  // Only run full diagnostics on mobile
  import('./src/utils/networkDiagnostics').then(({ runNetworkDiagnostics }) => {
    runNetworkDiagnostics();
  });
  
  import('./src/utils/roleIdInterceptor').then(({ enableRoleIdInterceptor }) => {
    enableRoleIdInterceptor();
  });
};

export default function App() {
  useEffect(() => {
    runDiagnostics();
  }, []);

  const AppContent = () => (
    <SafeAreaProvider>
      <TenantProvider>
        <AuthProvider>
          <SelectedStudentProvider>
            {Platform.OS === 'web' ? (
              <React.Suspense fallback={
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100vh',
                  backgroundColor: '#f5f5f5'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #3498db',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <p style={{ marginTop: '20px', color: '#666' }}>Loading VidyaSetu...</p>
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </div>
              }>
                <AppNavigator />
              </React.Suspense>
            ) : (
              <AppNavigator />
            )}
            <StatusBar style="auto" />
          </SelectedStudentProvider>
        </AuthProvider>
      </TenantProvider>
    </SafeAreaProvider>
  );

  return (
    <WebPerformanceMonitor>
      <AppContent />
    </WebPerformanceMonitor>
  );
}
