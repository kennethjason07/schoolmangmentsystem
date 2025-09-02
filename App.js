import React, { useEffect } from 'react';
import { runNetworkDiagnostics } from './src/utils/networkDiagnostics';
import { StatusBar } from 'expo-status-bar';
import { TenantProvider } from './src/contexts/TenantContext';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    runNetworkDiagnostics();
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
