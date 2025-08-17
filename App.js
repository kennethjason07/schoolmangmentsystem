import React, { useEffect } from 'react';
import { runNetworkDiagnostics } from './src/utils/networkDiagnostics';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    runNetworkDiagnostics();
  }, []);

  return (
    <AuthProvider>
      <SelectedStudentProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SelectedStudentProvider>
    </AuthProvider>
  );
}
