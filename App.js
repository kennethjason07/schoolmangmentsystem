import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/utils/AuthContext';
import { SelectedStudentProvider } from './src/contexts/SelectedStudentContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <SelectedStudentProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SelectedStudentProvider>
    </AuthProvider>
  );
}
