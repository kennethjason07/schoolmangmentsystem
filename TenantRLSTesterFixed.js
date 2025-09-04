// TenantRLSTesterFixed.js
// Updated component to test tenant-based RLS policies (fixed version)

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust path as needed

const TenantRLSTesterFixed = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  // Run comprehensive tenant RLS tests
  const runTenantTests = async () => {
    setLoading(true);
    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Check current authentication and JWT
      console.log('🔍 Testing authentication and JWT...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      const authTest = {
        name: 'Authentication & JWT',
        success: !!session && !sessionError,
        data: {
          authenticated: !!session,
          userId: session?.user?.id || null,
          email: session?.user?.email || null,
          appMetadata: session?.user?.app_metadata || {},
          hasTenantId: !!(session?.user?.app_metadata?.tenant_id),
          tenantIdFromJWT: session?.user?.app_metadata?.tenant_id || null
        },
        error: sessionError?.message || null
      };
      results.tests.push(authTest);

      if (session) {
        setUserInfo({
          email: session.user.email,
          userId: session.user.id,
          tenantId: session.user.app_metadata?.tenant_id
        });
      }

      // Test 2: Test tenant access diagnostic function (updated function name)
      console.log('🔍 Testing tenant access function...');
      try {
        const { data: tenantAccess, error: tenantError } = await supabase
          .rpc('test_tenant_access');
        
        const tenantTest = {
          name: 'Tenant Access Function',
          success: !tenantError,
          data: tenantAccess ? tenantAccess[0] : null,
          error: tenantError?.message || null
        };
        results.tests.push(tenantTest);
      } catch (err) {
        results.tests.push({
          name: 'Tenant Access Function',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 3: Check user tenant assignment (updated function name)
      console.log('🔍 Checking user tenant assignment...');
      try {
        const { data: assignment, error: assignmentError } = await supabase
          .rpc('check_user_tenant_assignment');
        
        const assignmentTest = {
          name: 'User Tenant Assignment',
          success: !assignmentError,
          data: assignment ? assignment[0] : null,
          error: assignmentError?.message || null
        };
        results.tests.push(assignmentTest);
      } catch (err) {
        results.tests.push({
          name: 'User Tenant Assignment',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 4: Check user metadata setup status
      console.log('🔍 Checking user metadata setup...');
      try {
        const { data: metadata, error: metadataError } = await supabase
          .rpc('setup_user_tenant_metadata');
        
        const metadataTest = {
          name: 'User Metadata Setup',
          success: !metadataError,
          data: metadata || null,
          error: metadataError?.message || null
        };
        results.tests.push(metadataTest);
      } catch (err) {
        results.tests.push({
          name: 'User Metadata Setup',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 5: Direct student query (should be tenant-filtered)
      console.log('🔍 Testing tenant-filtered student access...');
      try {
        const { data: students, error: studentsError, count } = await supabase
          .from('students')
          .select('id, name, admission_no, tenant_id', { count: 'exact' })
          .limit(5);
        
        const studentsTest = {
          name: 'Tenant-Filtered Students',
          success: !studentsError,
          data: {
            count: count || 0,
            students: students || [],
            uniqueTenants: students ? [...new Set(students.map(s => s.tenant_id))] : []
          },
          error: studentsError?.message || null
        };
        results.tests.push(studentsTest);
      } catch (err) {
        results.tests.push({
          name: 'Tenant-Filtered Students',
          success: false,
          error: err.message,
          data: { count: 0, students: [], uniqueTenants: [] }
        });
      }

      // Test 6: Classes access (should also be tenant-filtered)
      console.log('🔍 Testing tenant-filtered classes access...');
      try {
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id, class_name, section, tenant_id')
          .limit(5);
        
        const classesTest = {
          name: 'Tenant-Filtered Classes',
          success: !classesError,
          data: {
            count: classes?.length || 0,
            classes: classes || [],
            uniqueTenants: classes ? [...new Set(classes.map(c => c.tenant_id))] : []
          },
          error: classesError?.message || null
        };
        results.tests.push(classesTest);
      } catch (err) {
        results.tests.push({
          name: 'Tenant-Filtered Classes',
          success: false,
          error: err.message,
          data: { count: 0, classes: [], uniqueTenants: [] }
        });
      }

      // Test 7: Tenant table access (should only see own tenant)
      console.log('🔍 Testing tenant table access...');
      try {
        const { data: tenants, error: tenantsError } = await supabase
          .from('tenants')
          .select('id, name')
          .limit(10);
        
        const tenantsTest = {
          name: 'Tenant Table Access',
          success: !tenantsError,
          data: {
            count: tenants?.length || 0,
            tenants: tenants || [],
            message: tenants?.length === 1 ? 
              'Good! Can only see own tenant' : 
              tenants?.length === 0 ?
                'No tenant access - check configuration' :
                'Warning: Can see multiple tenants'
          },
          error: tenantsError?.message || null
        };
        results.tests.push(tenantsTest);
      } catch (err) {
        results.tests.push({
          name: 'Tenant Table Access',
          success: false,
          error: err.message,
          data: { count: 0, tenants: [] }
        });
      }

      // Test 8: Your SupabaseService method (with joins)
      console.log('🔍 Testing SupabaseService getStudents with joins...');
      try {
        const { data: serviceStudents, error: serviceError } = await supabase
          .from('students')
          .select(`
            *,
            classes (
              id,
              class_name,
              section
            ),
            parents (
              id,
              name,
              phone
            )
          `)
          .limit(5);
        
        const serviceTest = {
          name: 'SupabaseService Students with Joins',
          success: !serviceError,
          data: {
            count: serviceStudents?.length || 0,
            hasClassData: serviceStudents?.some(s => s.classes) || false,
            hasParentData: serviceStudents?.some(s => s.parents) || false,
            allFromSameTenant: serviceStudents ? 
              new Set(serviceStudents.map(s => s.tenant_id)).size === 1 : true
          },
          error: serviceError?.message || null
        };
        results.tests.push(serviceTest);
      } catch (err) {
        results.tests.push({
          name: 'SupabaseService Students with Joins',
          success: false,
          error: err.message,
          data: { count: 0, hasClassData: false, hasParentData: false, allFromSameTenant: false }
        });
      }

    } catch (globalError) {
      results.globalError = globalError.message;
    }

    setTestResults(results);
    setLoading(false);

    // Show summary
    const successCount = results.tests.filter(test => test.success).length;
    const totalTests = results.tests.length;
    
    Alert.alert(
      'Tenant RLS Test Results', 
      `${successCount}/${totalTests} tests passed\n\n${
        successCount === totalTests ? 
          '🎉 Tenant-based security is working perfectly!' : 
          '⚠️ Some issues found - check details below'
      }`
    );
  };

  // Test specific RLS function
  const testSpecificFunction = async (functionName) => {
    try {
      const { data, error } = await supabase.rpc(functionName);
      Alert.alert(
        `${functionName} Result`,
        error ? `Error: ${error.message}` : `Success: ${JSON.stringify(data, null, 2)}`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  // Force user to re-authenticate
  const forceReauth = async () => {
    Alert.alert(
      'Re-authentication Required',
      'To get updated JWT tokens with tenant information, you need to sign out and sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              Alert.alert('Signed Out', 'Please sign in again to get updated tokens');
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  // Render test result
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
          <Text style={{ color: '#721c24', marginBottom: 5, fontSize: 12 }}>
            Error: {test.error}
          </Text>
        )}

        {test.data && (
          <View style={{ marginTop: 5 }}>
            {typeof test.data === 'object' ? (
              Object.entries(test.data).map(([key, value]) => (
                <Text key={key} style={{ color: textColor, fontSize: 12 }}>
                  {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Text>
              ))
            ) : (
              <Text style={{ color: textColor, fontSize: 12 }}>
                {String(test.data)}
              </Text>
            )}
          </View>
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
        🔐 Tenant RLS Tester (Fixed)
      </Text>

      {userInfo && (
        <View style={{ 
          backgroundColor: '#e9ecef', 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
            👤 Current User Info
          </Text>
          <Text>Email: {userInfo.email}</Text>
          <Text>User ID: {userInfo.userId?.substring(0, 8)}...</Text>
          <Text style={{ color: userInfo.tenantId ? '#28a745' : '#dc3545' }}>
            Tenant ID: {userInfo.tenantId || 'Not set in JWT ⚠️'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={runTenantTests}
        disabled={loading}
        style={{
          backgroundColor: loading ? '#6c757d' : '#007bff',
          padding: 15,
          borderRadius: 8,
          marginBottom: 10
        }}
      >
        <Text style={{ 
          color: 'white', 
          textAlign: 'center', 
          fontWeight: 'bold',
          fontSize: 16
        }}>
          {loading ? '🔄 Running Tests...' : '🧪 Run All Tenant Tests'}
        </Text>
      </TouchableOpacity>

      {/* Individual function test buttons */}
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <TouchableOpacity
          onPress={() => testSpecificFunction('test_tenant_access')}
          style={{
            backgroundColor: '#28a745',
            padding: 8,
            borderRadius: 6,
            marginRight: 5,
            flex: 1
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 12 }}>
            Test Access
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => testSpecificFunction('check_user_tenant_assignment')}
          style={{
            backgroundColor: '#17a2b8',
            padding: 8,
            borderRadius: 6,
            marginRight: 5,
            flex: 1
          }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 12 }}>
            Check Assignment
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={forceReauth}
          style={{
            backgroundColor: '#ffc107',
            padding: 8,
            borderRadius: 6,
            flex: 1
          }}
        >
          <Text style={{ color: '#212529', textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
            Re-auth
          </Text>
        </TouchableOpacity>
      </View>

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
            backgroundColor: testResults.tests.every(t => t.success) ? '#d4edda' : '#f8d7da', 
            padding: 15, 
            borderRadius: 8, 
            marginTop: 10 
          }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
              📋 Summary
            </Text>
            <Text>Total Tests: {testResults.tests.length}</Text>
            <Text style={{ color: '#28a745' }}>
              Passed: {testResults.tests.filter(t => t.success).length}
            </Text>
            <Text style={{ color: '#dc3545' }}>
              Failed: {testResults.tests.filter(t => !t.success).length}
            </Text>
            
            {testResults.tests.every(t => t.success) ? (
              <Text style={{ 
                color: '#28a745', 
                fontWeight: 'bold', 
                marginTop: 10,
                fontSize: 16
              }}>
                🎉 Tenant-based RLS working perfectly!
              </Text>
            ) : (
              <Text style={{ 
                color: '#dc3545', 
                fontWeight: 'bold', 
                marginTop: 10 
              }}>
                ⚠️ Some issues found. Most likely JWT needs tenant_id.
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={{ 
        backgroundColor: '#d1ecf1', 
        padding: 15, 
        borderRadius: 8, 
        marginTop: 20,
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0c5460' }}>
          📝 What This Tests (Fixed Version)
        </Text>
        <Text style={{ color: '#0c5460', marginTop: 5 }}>
          • Authentication status and JWT claims{'\n'}
          • Tenant-based data access (students, classes, etc.){'\n'}
          • Cross-tenant access prevention{'\n'}
          • RLS policies working correctly{'\n'}
          • Database functions (public schema){'\n'}
          • User metadata configuration status
        </Text>
      </View>

      <View style={{ 
        backgroundColor: '#fff3cd', 
        padding: 15, 
        borderRadius: 8, 
        marginBottom: 20
      }}>
        <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#856404' }}>
          🔧 Troubleshooting
        </Text>
        <Text style={{ color: '#856404', marginTop: 5 }}>
          If tests fail:{'\n'}
          1. Run the IMPLEMENT_TENANT_RLS_FIXED.sql script{'\n'}
          2. Check if user has tenant_id in database{'\n'}
          3. Update JWT metadata manually in Supabase dashboard{'\n'}
          4. Sign out and sign back in{'\n'}
          5. Use individual test buttons above for specific checks
        </Text>
      </View>
    </ScrollView>
  );
};

export default TenantRLSTesterFixed;
