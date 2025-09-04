// TeacherTenantRLSTester.js
// Component to test teacher-specific tenant-based RLS policies

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust path as needed

const TeacherTenantRLSTester = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teacherStats, setTeacherStats] = useState(null);

  // Run comprehensive teacher tenant RLS tests
  const runTeacherTests = async () => {
    setLoading(true);
    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    try {
      // Test 1: Teacher-specific tenant access
      console.log('🧑‍🏫 Testing teacher tenant access...');
      try {
        const { data: teacherAccess, error: teacherError } = await supabase
          .rpc('test_teachers_tenant_access');
        
        const teacherTest = {
          name: 'Teacher Tenant Access',
          success: !teacherError && teacherAccess && teacherAccess[0]?.teacher_count > 0,
          data: teacherAccess ? teacherAccess[0] : null,
          error: teacherError?.message || null
        };
        results.tests.push(teacherTest);
      } catch (err) {
        results.tests.push({
          name: 'Teacher Tenant Access',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 2: Direct teacher query
      console.log('🧑‍🏫 Testing direct teacher query...');
      try {
        const { data: teachers, error: teachersError, count } = await supabase
          .from('teachers')
          .select('id, name, qualification, salary_type, salary_amount, tenant_id, is_class_teacher', { count: 'exact' })
          .limit(10);
        
        const teachersTest = {
          name: 'Direct Teacher Query',
          success: !teachersError,
          data: {
            count: count || 0,
            teachers: teachers || [],
            uniqueTenants: teachers ? [...new Set(teachers.map(t => t.tenant_id))] : [],
            classTeachers: teachers ? teachers.filter(t => t.is_class_teacher).length : 0,
            salaryTypes: teachers ? [...new Set(teachers.map(t => t.salary_type))] : []
          },
          error: teachersError?.message || null
        };
        results.tests.push(teachersTest);
      } catch (err) {
        results.tests.push({
          name: 'Direct Teacher Query',
          success: false,
          error: err.message,
          data: { count: 0, teachers: [], uniqueTenants: [], classTeachers: 0, salaryTypes: [] }
        });
      }

      // Test 3: Teacher-class relationships
      console.log('🧑‍🏫 Testing teacher-class relationships...');
      try {
        const { data: relationships, error: relationshipError } = await supabase
          .rpc('check_teacher_class_relationships');
        
        const relationshipTest = {
          name: 'Teacher-Class Relationships',
          success: !relationshipError,
          data: relationships || [],
          error: relationshipError?.message || null
        };
        results.tests.push(relationshipTest);
      } catch (err) {
        results.tests.push({
          name: 'Teacher-Class Relationships',
          success: false,
          error: err.message,
          data: []
        });
      }

      // Test 4: Teacher statistics
      console.log('🧑‍🏫 Testing teacher statistics...');
      try {
        const { data: stats, error: statsError } = await supabase
          .rpc('get_teacher_tenant_stats');
        
        const statsTest = {
          name: 'Teacher Statistics',
          success: !statsError,
          data: stats ? stats[0] : null,
          error: statsError?.message || null
        };
        results.tests.push(statsTest);
        
        if (stats && stats[0]) {
          setTeacherStats(stats[0]);
        }
      } catch (err) {
        results.tests.push({
          name: 'Teacher Statistics',
          success: false,
          error: err.message,
          data: null
        });
      }

      // Test 5: Teacher with class joins
      console.log('🧑‍🏫 Testing teacher with class joins...');
      try {
        const { data: teachersWithClasses, error: joinError } = await supabase
          .from('teachers')
          .select(`
            id,
            name,
            qualification,
            salary_type,
            salary_amount,
            is_class_teacher,
            classes!teachers_assigned_class_id_fkey (
              id,
              class_name,
              section,
              academic_year
            )
          `)
          .limit(5);
        
        const joinTest = {
          name: 'Teachers with Class Joins',
          success: !joinError,
          data: {
            count: teachersWithClasses?.length || 0,
            hasClassData: teachersWithClasses?.some(t => t.classes) || false,
            teachersWithClasses: teachersWithClasses?.filter(t => t.classes).length || 0
          },
          error: joinError?.message || null
        };
        results.tests.push(joinTest);
      } catch (err) {
        results.tests.push({
          name: 'Teachers with Class Joins',
          success: false,
          error: err.message,
          data: { count: 0, hasClassData: false, teachersWithClasses: 0 }
        });
      }

      // Test 6: Teacher subjects
      console.log('🧑‍🏫 Testing teacher subjects...');
      try {
        const { data: teacherSubjects, error: subjectError } = await supabase
          .from('teacher_subjects')
          .select(`
            id,
            teacher_id,
            subject_id,
            teachers (
              name,
              tenant_id
            ),
            subjects (
              name,
              tenant_id
            )
          `)
          .limit(5);
        
        const subjectTest = {
          name: 'Teacher Subjects',
          success: !subjectError,
          data: {
            count: teacherSubjects?.length || 0,
            subjects: teacherSubjects || [],
            crossTenantIssues: teacherSubjects ? 
              teacherSubjects.filter(ts => 
                ts.teachers?.tenant_id !== ts.subjects?.tenant_id
              ).length : 0
          },
          error: subjectError?.message || null
        };
        results.tests.push(subjectTest);
      } catch (err) {
        results.tests.push({
          name: 'Teacher Subjects',
          success: false,
          error: err.message,
          data: { count: 0, subjects: [], crossTenantIssues: 0 }
        });
      }

      // Test 7: Teacher attendance
      console.log('🧑‍🏫 Testing teacher attendance access...');
      try {
        const { data: attendance, error: attendanceError } = await supabase
          .from('teacher_attendance')
          .select('id, teacher_id, date, status, tenant_id')
          .limit(5);
        
        const attendanceTest = {
          name: 'Teacher Attendance Access',
          success: !attendanceError,
          data: {
            count: attendance?.length || 0,
            attendance: attendance || [],
            uniqueTenants: attendance ? [...new Set(attendance.map(a => a.tenant_id))] : []
          },
          error: attendanceError?.message || null
        };
        results.tests.push(attendanceTest);
      } catch (err) {
        results.tests.push({
          name: 'Teacher Attendance Access',
          success: false,
          error: err.message,
          data: { count: 0, attendance: [], uniqueTenants: [] }
        });
      }

      // Test 8: Cross-tenant teacher access prevention
      console.log('🧑‍🏫 Testing cross-tenant prevention...');
      try {
        // Try to access teachers from all tenants (should only see current tenant)
        const { data: allTeachers, error: allTeachersError } = await supabase
          .from('teachers')
          .select('id, name, tenant_id');
        
        const uniqueTenantsInResult = allTeachers ? [...new Set(allTeachers.map(t => t.tenant_id))] : [];
        
        const crossTenantTest = {
          name: 'Cross-Tenant Prevention',
          success: !allTeachersError && uniqueTenantsInResult.length <= 1,
          data: {
            totalTeachers: allTeachers?.length || 0,
            uniqueTenants: uniqueTenantsInResult,
            message: uniqueTenantsInResult.length <= 1 ? 
              'Good! Only seeing single tenant data' : 
              'Warning: Seeing multiple tenant data'
          },
          error: allTeachersError?.message || null
        };
        results.tests.push(crossTenantTest);
      } catch (err) {
        results.tests.push({
          name: 'Cross-Tenant Prevention',
          success: false,
          error: err.message,
          data: { totalTeachers: 0, uniqueTenants: [] }
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
      'Teacher RLS Test Results', 
      `${successCount}/${totalTests} tests passed\n\n${
        successCount === totalTests ? 
          '🎉 Teacher tenant-based security working perfectly!' : 
          '⚠️ Some teacher access issues found'
      }`
    );
  };

  // Test specific teacher function
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

  // Create sample teacher
  const createSampleTeacher = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.data?.session) {
        Alert.alert('Error', 'You must be signed in to create sample data');
        return;
      }

      // Get current user's tenant
      const { data: currentUser } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', session.data.session.user.id)
        .single();

      if (!currentUser?.tenant_id) {
        Alert.alert('Error', 'User has no tenant assigned');
        return;
      }

      // Get a random class from current tenant
      const { data: classes } = await supabase
        .from('classes')
        .select('id')
        .eq('tenant_id', currentUser.tenant_id)
        .limit(1);

      const { data, error } = await supabase
        .from('teachers')
        .insert({
          name: `Teacher ${Date.now()}`,
          qualification: 'B.Ed, Sample Qualification',
          age: 30,
          salary_type: 'monthly',
          salary_amount: 45000,
          address: 'Sample Address',
          tenant_id: currentUser.tenant_id,
          assigned_class_id: classes?.[0]?.id || null,
          is_class_teacher: false,
          phone: '123-456-7890'
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error creating teacher', error.message);
      } else {
        Alert.alert('Success', `Created teacher: ${data.name}`);
        runTeacherTests(); // Refresh tests
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
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
        🧑‍🏫 Teacher Tenant RLS Tester
      </Text>

      {/* Teacher Stats Summary */}
      {teacherStats && (
        <View style={{ 
          backgroundColor: '#e7f3ff', 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#0066cc' }}>
            📊 Teacher Statistics
          </Text>
          <Text>Tenant: {teacherStats.tenant_name}</Text>
          <Text>Total Teachers: {teacherStats.total_teachers}</Text>
          <Text>Class Teachers: {teacherStats.class_teachers}</Text>
          <Text>Unassigned: {teacherStats.unassigned_teachers}</Text>
          <Text>Monthly Salary: {teacherStats.monthly_salary_teachers}</Text>
          <Text>Hourly Salary: {teacherStats.hourly_salary_teachers}</Text>
          <Text>Average Salary: ${teacherStats.average_salary}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={runTeacherTests}
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
          {loading ? '🔄 Running Teacher Tests...' : '🧑‍🏫 Test Teacher RLS'}
        </Text>
      </TouchableOpacity>

      {/* Teacher-specific function test buttons */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', marginBottom: 5 }}>
          <TouchableOpacity
            onPress={() => testSpecificFunction('test_teachers_tenant_access')}
            style={{
              backgroundColor: '#28a745',
              padding: 8,
              borderRadius: 6,
              marginRight: 5,
              flex: 1
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 11 }}>
              Teacher Access
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => testSpecificFunction('check_teacher_class_relationships')}
            style={{
              backgroundColor: '#17a2b8',
              padding: 8,
              borderRadius: 6,
              marginRight: 5,
              flex: 1
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 11 }}>
              Class Relations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => testSpecificFunction('get_teacher_tenant_stats')}
            style={{
              backgroundColor: '#6f42c1',
              padding: 8,
              borderRadius: 6,
              flex: 1
            }}
          >
            <Text style={{ color: 'white', textAlign: 'center', fontSize: 11 }}>
              Teacher Stats
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={createSampleTeacher}
          style={{
            backgroundColor: '#ffc107',
            padding: 8,
            borderRadius: 6,
            marginTop: 5
          }}
        >
          <Text style={{ color: '#212529', textAlign: 'center', fontSize: 14, fontWeight: 'bold' }}>
            ➕ Create Sample Teacher
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
            📊 Teacher Test Results ({new Date(testResults.timestamp).toLocaleTimeString()})
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
                🎉 Teacher tenant-based RLS working perfectly!
              </Text>
            ) : (
              <Text style={{ 
                color: '#dc3545', 
                fontWeight: 'bold', 
                marginTop: 10 
              }}>
                ⚠️ Some teacher access issues found. Check individual results.
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
          📝 What This Tests for Teachers
        </Text>
        <Text style={{ color: '#0c5460', marginTop: 5 }}>
          • Teacher data access within tenant{'\n'}
          • Teacher-class relationship integrity{'\n'}
          • Teacher-subject assignment access{'\n'}
          • Teacher attendance data isolation{'\n'}
          • Cross-tenant teacher access prevention{'\n'}
          • Teacher statistics and reporting{'\n'}
          • Join queries with related tables
        </Text>
      </View>
    </ScrollView>
  );
};

export default TeacherTenantRLSTester;
