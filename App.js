import React, { useEffect } from 'react';
// import { runNetworkDiagnostics } from './src/utils/networkDiagnostics';
import { enableRoleIdInterceptor } from './src/utils/roleIdInterceptor';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TenantProvider } from './src/contexts/TenantContext';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import { GlobalRefreshProvider } from './src/contexts/GlobalRefreshContext';
import StartupLoader from './src/components/StartupLoader';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    // Run network diagnostics (disabled for web build compatibility)
    // runNetworkDiagnostics();

    // Enable universal role_id validation interceptor
    enableRoleIdInterceptor();
  }, []);

  return (
    <SafeAreaProvider>
      <TenantProvider>
        <AuthProvider>
          <StartupLoader>
            <SelectedStudentProvider>
              <GlobalRefreshProvider>
                <AppNavigator />
                <StatusBar style="auto" />
              </GlobalRefreshProvider>
            </SelectedStudentProvider>
          </StartupLoader>
        </AuthProvider>
      </TenantProvider>
    </SafeAreaProvider>
  );
}
