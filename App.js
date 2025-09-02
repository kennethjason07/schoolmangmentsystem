import React, { useEffect } from 'react';
import { runNetworkDiagnostics } from './src/utils/networkDiagnostics';
import { enableRoleIdInterceptor } from './src/utils/roleIdInterceptor';
import { StatusBar } from 'expo-status-bar';
import { TenantProvider } from './src/contexts/TenantContext';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    // Run network diagnostics
    runNetworkDiagnostics();
    
    // Enable universal role_id validation interceptor
    console.log('🚀 [App] Enabling universal role_id interceptor...');
    enableRoleIdInterceptor();
  }, []);

  return (
    <TenantProvider>
      <AuthProvider>
        <SelectedStudentProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </SelectedStudentProvider>
      </AuthProvider>
    </TenantProvider>
  );
}
