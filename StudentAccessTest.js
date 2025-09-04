// StudentAccessTest.js
// Quick test component to verify emergency student access fix

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust path as needed

const StudentAccessTest = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Test 1: Direct student query
  const testDirectStudentQuery = async () => {
    try {
      console.log('🧪 Testing direct student query...');
      const { data, error, count } = await supabase
        .from('students')
        .select('*', { count: 'exact' })
        .limit(5);
      
      return {
        name: 'Direct Student Query',
        success: !error,
        error: error?.message || null,
        count: count || 0,
        data: data || [],
        details: error ? `Code: ${error.code}, Details: ${error.details}` : null
      };
    } catch (err) {
      return {
        name: 'Direct Student Query',
        success: false,
        error: err.message,
        count: 0,
        data: []
      };
    }
  };

  // Test 2: Simple diagnostic function
  const testDiagnosticFunction = async () => {
    try {
      console.log('🧪 Testing diagnostic function...');
      const { data, error } = await supabase.rpc('simple_student_test');
      
      return {
        name: 'Diagnostic Function',
        success: !error,
        error: error?.message || null,
        result: data || null
      };
    } catch (err) {
      return {
        name: 'Diagnostic Function',
        success: false,
        error: err.message,
        result: null
      };
    }
  };

  // Test 3: Check authentication
  const testAuthentication = async () => {
    try {
      console.log('🧪 Testing authentication...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      return {
        name: 'Authentication',
        success: !!session && !error,
        error: error?.message || null,
        authenticated: !!session,
        userId: session?.user?.id || null,
        email: session?.user?.email || null
      };
    } catch (err) {
      return {
        name: 'Authentication',
        success: false,
        error: err.message,
        authenticated: false
      };
    }
  };

  // Test 4: Student with class join
  const testStudentWithClasses = async () => {
    try {
      console.log('🧪 Testing student with classes join...');
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          admission_no,
          classes (
            id,
            class_name,
            section
          )
        `)
        .limit(3);
      
      return {
        name: 'Student with Classes',
        success: !error,
        error: error?.message || null,
        count: data?.length || 0,
        data: data || []
      };
    } catch (err) {
      return {
        name: 'Student with Classes',
        success: false,
        error: err.message,
        count: 0,
        data: []
      };
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setLoading(true);
    console.log('🚀 Starting emergency access tests...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Run tests sequentially
    results.tests.push(await testAuthentication());
    results.tests.push(await testDirectStudentQuery());
    results.tests.push(await testDiagnosticFunction());
    results.tests.push(await testStudentWithClasses());

    setTestResults(results);
    setLoading(false);

    // Show summary
    const successCount = results.tests.filter(test => test.success).length;
    const totalTests = results.tests.length;
    
    Alert.alert(
      'Test Results', 
      `${successCount}/${totalTests} tests passed\n\nCheck the detailed results below.`
    );
  };

  // Format test result display
  const renderTestResult = (test, index) => {
    const bgColor = test.success ? '#d4edda' : '#f8d7da';
    const textColor = test.success ? '#155724' : '#721c24';
    const icon = test.success ? '✅' : '❌';

    return (
      <View key={index} style={{ 
        backgroundColor: bgColor, 
        padding: 15, 
        marginBottom: 10, 
        borderRadius: 8,
        borderWidth: 1,
        borderColor: test.success ? '#c3e6cb' : '#f5c6cb'
      }}>
        <Text style={{ 
          fontSize: 16, 
          fontWeight: 'bold', 
          color: textColor,
          marginBottom: 5
        }}>
          {icon} {test.name}
        </Text>
        
        {test.error && (
          <Text style={{ color: '#721c24', marginBottom: 5 }}>
            Error: {test.error}
          </Text>
        )}

        {test.details && (
          <Text style={{ color: '#856404', marginBottom: 5, fontSize: 12 }}>
            {test.details}
          </Text>
        )}

        {test.count !== undefined && (
          <Text style={{ color: textColor }}>
            Records found: {test.count}
          </Text>
        )}

        {test.authenticated !== undefined && (
          <Text style={{ color: textColor }}>
            Authenticated: {test.authenticated ? 'Yes' : 'No'}
            {test.userId && ` (ID: ${test.userId.substring(0, 8)}...)`}
          </Text>
        )}

        {test.result && (
          <Text style={{ color: textColor, fontSize: 12, marginTop: 5 }}>
            Result: {JSON.stringify(test.result, null, 2)}
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#f8f9fa' }}>
      <Text style={{ 
        fontSize: 24, 
        fontWeight: 'bold', 
        textAlign: 'center', 
        marginBottom: 20,
        color: '#333'
      }}>
        🧪 Emergency Access Test
      </Text>

      <TouchableOpacity
        onPress={runAllTests}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#6c757d' : '#007bff',
          padding: 15,
          borderRadius: 8,
          marginBottom: 20
        }}
      >
        <Text style={{ 
          color: 'white', 
          textAlign: 'center', 
          fontWeight: 'bold',
          fontSize: 16
        }}>
          {loading ? '🔄 Running Tests...' : '🚀 Run Emergency Tests'}
        </Text>
      </TouchableOpacity>

      {testResults && (
        <View>
          <Text style={{ 
            fontSize: 18, 
            fontWeight: 'bold', 
            marginBottom: 15,
            color: '#333'
          }}>
            📊 Test Results ({new Date(testResults.timestamp).toLocaleTimeString()})
          </Text>

          {testResults.tests.map(renderTestResult)}

          <View style={{ 
            backgroundColor: '#e9ecef', 
            padding: 15, 
            borderRadius: 8, 
            marginTop: 10 
          }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
              📝 Summary
            </Text>
            <Text>Total Tests: {testResults.tests.length}</Text>
            <Text style={{ color: '#28a745' }}>
              Passed: {testResults.tests.filter(t => t.success).length}
            </Text>
            <Text style={{ color: '#dc3545' }}>
              Failed: {testResults.tests.filter(t => !t.success).length}
            </Text>
            
            {testResults.tests.filter(t => t.success).length === testResults.tests.length ? (
              <Text style={{ 
                color: '#28a745', 
                fontWeight: 'bold', 
                marginTop: 10,
                fontSize: 16
              }}>
                🎉 All tests passed! Emergency fix successful!
              </Text>
            ) : (
              <Text style={{ 
                color: '#dc3545', 
                fontWeight: 'bold', 
                marginTop: 10 
              }}>
                ⚠️ Some tests failed. Check individual results above.
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={{ 
        backgroundColor: '#fff3cd', 
        padding: 15, 
        borderRadius: 8, 
        marginTop: 20,
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#856404' }}>
          💡 Instructions
        </Text>
        <Text style={{ color: '#856404', marginTop: 5 }}>
          1. First run the EMERGENCY_STUDENT_ACCESS_FIX_CORRECTED.sql script
          2. Then run these tests to verify the fix worked
          3. If all tests pass, your main app should now show students!
        </Text>
      </View>
    </ScrollView>
  );
};

export default StudentAccessTest;
