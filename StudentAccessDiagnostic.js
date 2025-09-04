// StudentAccessDiagnostic.js
// Comprehensive diagnostic component for student access issues

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust path as needed

const StudentAccessDiagnostic = () => {
  const [diagnosticResults, setDiagnosticResults] = useState({});
  const [loading, setLoading] = useState(false);

  // Run comprehensive diagnostics
  const runDiagnostics = async () => {
    setLoading(true);
    const results = {};

    try {
      // 1. Check authentication status
      console.log('🔍 Checking authentication...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      results.auth = {
        isAuthenticated: !!session,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        sessionError: sessionError?.message || null,
        accessToken: session?.access_token ? 'Present' : 'Missing',
        refreshToken: session?.refresh_token ? 'Present' : 'Missing'
      };

      // 2. Test direct database connection
      console.log('🔍 Testing database connection...');
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('tenants')
          .select('id, name')
          .limit(1);
        
        results.connection = {
          status: connectionError ? 'Failed' : 'Success',
          error: connectionError?.message || null,
          data: connectionTest || null
        };
      } catch (err) {
        results.connection = {
          status: 'Failed',
          error: err.message,
          data: null
        };
      }

      // 3. Test student table access (raw query)
      console.log('🔍 Testing student table access...');
      try {
        const { data: students, error: studentsError, count } = await supabase
          .from('students')
          .select('*', { count: 'exact' })
          .limit(5);
        
        results.students = {
          status: studentsError ? 'Failed' : 'Success',
          error: studentsError?.message || null,
          count: count || 0,
          sampleData: students || [],
          details: studentsError?.details || null,
          hint: studentsError?.hint || null,
          code: studentsError?.code || null
        };
      } catch (err) {
        results.students = {
          status: 'Failed',
          error: err.message,
          count: 0,
          sampleData: []
        };
      }

      // 4. Test with explicit tenant filtering
      console.log('🔍 Testing tenant-filtered student access...');
      if (results.connection.data && results.connection.data.length > 0) {
        const tenantId = results.connection.data[0].id;
        try {
          const { data: tenantStudents, error: tenantError } = await supabase
            .from('students')
            .select('*')
            .eq('tenant_id', tenantId)
            .limit(5);
          
          results.tenantFiltered = {
            tenantId: tenantId,
            status: tenantError ? 'Failed' : 'Success',
            error: tenantError?.message || null,
            count: tenantStudents?.length || 0,
            data: tenantStudents || []
          };
        } catch (err) {
          results.tenantFiltered = {
            tenantId: tenantId,
            status: 'Failed',
            error: err.message,
            count: 0,
            data: []
          };
        }
      }

      // 5. Test the diagnostic function we created
      console.log('🔍 Testing diagnostic function...');
      try {
        const { data: diagnostic, error: diagnosticError } = await supabase
          .rpc('test_student_access');
        
        results.diagnostic = {
          status: diagnosticError ? 'Failed' : 'Success',
          error: diagnosticError?.message || null,
          result: diagnostic || null
        };
      } catch (err) {
        results.diagnostic = {
          status: 'Failed',
          error: err.message,
          result: null
        };
      }

      // 6. Test your actual SupabaseService method
      console.log('🔍 Testing SupabaseService getStudents...');
      try {
        // Import your actual service
        // const SupabaseService = require('../path/to/your/SupabaseService');
        // const serviceResult = await SupabaseService.getStudents();
        
        // For now, simulate the service call
        const { data: serviceStudents, error: serviceError } = await supabase
          .from('students')
          .select(`
            *,
            classes (
              id,
              class_name,
              section
            )
          `);
        
        results.service = {
          status: serviceError ? 'Failed' : 'Success',
          error: serviceError?.message || null,
          count: serviceStudents?.length || 0,
          data: serviceStudents || []
        };
      } catch (err) {
        results.service = {
          status: 'Failed',
          error: err.message,
          count: 0,
          data: []
        };
      }

      // 7. Check Supabase client configuration
      results.config = {
        supabaseUrl: supabase.supabaseUrl ? 'Set' : 'Missing',
        supabaseKey: supabase.supabaseKey ? 'Set' : 'Missing',
        authType: typeof supabase.auth,
        clientVersion: 'Check manually'
      };

    } catch (globalError) {
      results.globalError = globalError.message;
    }

    setDiagnosticResults(results);
    setLoading(false);
  };

  // Fix authentication issues
  const fixAuthentication = async () => {
    try {
      // Force refresh session
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        Alert.alert('Refresh Failed', error.message);
      } else {
        Alert.alert('Success', 'Session refreshed successfully');
        runDiagnostics();
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Force sign out and back in
  const forceReauth = async () => {
    try {
      await supabase.auth.signOut();
      Alert.alert('Signed Out', 'Please sign in again');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>
        🔍 Student Access Diagnostics
      </Text>

      <TouchableOpacity
        onPress={runDiagnostics}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#ccc' : '#007bff',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20
        }}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: 'bold' }}>
          {loading ? 'Running Diagnostics...' : '🔄 Run Diagnostics'}
        </Text>
      </TouchableOpacity>

      {/* Authentication Status */}
      <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          🔐 Authentication Status
        </Text>
        <Text>Authenticated: {diagnosticResults.auth?.isAuthenticated ? '✅ Yes' : '❌ No'}</Text>
        <Text>User ID: {diagnosticResults.auth?.userId || '❌ None'}</Text>
        <Text>Email: {diagnosticResults.auth?.userEmail || '❌ None'}</Text>
        <Text>Access Token: {diagnosticResults.auth?.accessToken || '❌ Missing'}</Text>
        {diagnosticResults.auth?.sessionError && (
          <Text style={{ color: 'red' }}>Error: {diagnosticResults.auth.sessionError}</Text>
        )}
      </View>

      {/* Database Connection */}
      <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          🔌 Database Connection
        </Text>
        <Text>Status: {diagnosticResults.connection?.status === 'Success' ? '✅ Connected' : '❌ Failed'}</Text>
        {diagnosticResults.connection?.error && (
          <Text style={{ color: 'red' }}>Error: {diagnosticResults.connection.error}</Text>
        )}
      </View>

      {/* Student Table Access */}
      <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
          👥 Student Table Access
        </Text>
        <Text>Status: {diagnosticResults.students?.status === 'Success' ? '✅ Success' : '❌ Failed'}</Text>
        <Text>Count: {diagnosticResults.students?.count || 0} students found</Text>
        {diagnosticResults.students?.error && (
          <>
            <Text style={{ color: 'red', fontWeight: 'bold' }}>Error: {diagnosticResults.students.error}</Text>
            {diagnosticResults.students.code && (
              <Text style={{ color: 'red' }}>Code: {diagnosticResults.students.code}</Text>
            )}
            {diagnosticResults.students.details && (
              <Text style={{ color: 'orange' }}>Details: {diagnosticResults.students.details}</Text>
            )}
            {diagnosticResults.students.hint && (
              <Text style={{ color: 'blue' }}>Hint: {diagnosticResults.students.hint}</Text>
            )}
          </>
        )}
      </View>

      {/* Diagnostic Function Results */}
      {diagnosticResults.diagnostic && (
        <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            🔬 Diagnostic Function
          </Text>
          <Text>Status: {diagnosticResults.diagnostic.status === 'Success' ? '✅ Success' : '❌ Failed'}</Text>
          {diagnosticResults.diagnostic.result && (
            <Text>Result: {JSON.stringify(diagnosticResults.diagnostic.result, null, 2)}</Text>
          )}
          {diagnosticResults.diagnostic.error && (
            <Text style={{ color: 'red' }}>Error: {diagnosticResults.diagnostic.error}</Text>
          )}
        </View>
      )}

      {/* Fix Actions */}
      <View style={{ backgroundColor: 'white', padding: 15, marginBottom: 10, borderRadius: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>
          🛠️ Quick Fixes
        </Text>
        
        <TouchableOpacity
          onPress={fixAuthentication}
          style={{
            backgroundColor: '#28a745',
            padding: 12,
            borderRadius: 6,
            marginBottom: 10
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>🔄 Refresh Authentication</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={forceReauth}
          style={{
            backgroundColor: '#dc3545',
            padding: 12,
            borderRadius: 6
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center' }}>🚪 Force Sign Out & Re-login</Text>
        </TouchableOpacity>
      </View>

      {/* Raw Results (for debugging) */}
      {Object.keys(diagnosticResults).length > 0 && (
        <View style={{ backgroundColor: '#f8f9fa', padding: 15, borderRadius: 8, marginTop: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
            📝 Raw Results (for developers)
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
            {JSON.stringify(diagnosticResults, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

export default StudentAccessDiagnostic;
