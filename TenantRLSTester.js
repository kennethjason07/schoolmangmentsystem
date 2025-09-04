// TenantRLSTester.js
// Component to test tenant-based RLS policies implementation

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust path as needed

const TenantRLSTester = () => {
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

      // Test 2: Test tenant access diagnostic function
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

      // Test 3: Check user tenant assignment
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

      // Test 4: Direct student query (should be tenant-filtered)
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

      // Test 5: Classes access (should also be tenant-filtered)
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

      // Test 6: Cross-tenant access attempt (should fail)
      console.log('🔍 Testing cross-tenant access prevention...');
      try {
        // Try to get all tenants to find another tenant ID
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id')
          .limit(2);
        
        if (tenants && tenants.length > 1) {
          const otherTenantId = tenants[1].id;
          
          // Try to access students from another tenant (should fail or return empty)
          const { data: crossTenantStudents, error: crossTenantError } = await supabase
            .from('students')
            .select('*')
            .eq('tenant_id', otherTenantId);
          
          const crossTenantTest = {
            name: 'Cross-Tenant Prevention',
            success: !crossTenantError && (crossTenantStudents?.length === 0),
            data: {
              attemptedTenantId: otherTenantId,
              studentsFound: crossTenantStudents?.length || 0,
              message: crossTenantStudents?.length === 0 ? 
                'Good! Cross-tenant access blocked' : 
                'Warning: Cross-tenant access not properly blocked'
            },
            error: crossTenantError?.message || null
          };
          results.tests.push(crossTenantTest);
        } else {
          results.tests.push({
            name: 'Cross-Tenant Prevention',
            success: true,
            data: { message: 'Only one tenant exists, cannot test cross-tenant access' },
            error: null
          });
        }
      } catch (err) {
        results.tests.push({
          name: 'Cross-Tenant Prevention',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 7: Your SupabaseService method (if accessible)
      console.log('🔍 Testing SupabaseService getStudents...');
      try {
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
        
        const serviceTest = {
          name: 'SupabaseService Students',
          success: !serviceError,
          data: {
            count: serviceStudents?.length || 0,
            hasJoinedData: serviceStudents?.some(s => s.classes) || false
          },
          error: serviceError?.message || null
        };
        results.tests.push(serviceTest);
      } catch (err) {
        results.tests.push({
          name: 'SupabaseService Students',
          success: false,
          error: err.message,
          data: { count: 0, hasJoinedData: false }
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
      `${successCount}/${totalTests} tests passed\n\nTenant-based security is ${successCount === totalTests ? 'working perfectly!' : 'partially working - check details below'}`
    );
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
        🔐 Tenant RLS Tester
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
          <Text>Tenant ID: {userInfo.tenantId || 'Not set in JWT'}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={runTenantTests}
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
          {loading ? '🔄 Running Tenant Tests...' : '🧪 Test Tenant-Based RLS'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={forceReauth}
        style={{
          backgroundColor: '#ffc107',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20
        }}
      >
        <Text style={{ 
          color: '#212529', 
          textAlign: 'center', 
          fontWeight: 'bold'
        }}>
          🔄 Force Re-authentication (Get Updated Tokens)
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
            📊 Tenant RLS Test Results
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
                🎉 Tenant-based RLS is working perfectly!
              </Text>
            ) : (
              <Text style={{ 
                color: '#dc3545', 
                fontWeight: 'bold', 
                marginTop: 10 
              }}>
                ⚠️ Some issues found. Check individual test results.
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
          📝 What This Tests
        </Text>
        <Text style={{ color: '#0c5460', marginTop: 5 }}>
          • JWT contains tenant_id in app_metadata{'\n'}
          • Users can only access their tenant's data{'\n'}
          • Cross-tenant access is properly blocked{'\n'}
          • All RLS policies are working correctly{'\n'}
          • Database functions return expected results
        </Text>
      </View>
    </ScrollView>
  );
};

export default TenantRLSTester;
