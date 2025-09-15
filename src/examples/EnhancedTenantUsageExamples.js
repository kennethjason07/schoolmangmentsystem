/**
 * 🚀 ENHANCED TENANT USAGE EXAMPLES
 * 
 * This file demonstrates how to use the improved tenant system that caches
 * tenant ID instead of fetching it on every database operation.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { useTenantAccess, tenantDatabase } from '../utils/tenantHelpers';

/**
 * Example 1: Using the enhanced tenant hook in components
 */
export const StudentListScreen = () => {
  const { getTenantId, isReady, isLoading, error, tenantName } = useTenantAccess();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadStudents = async () => {
    try {
      setLoading(true);
      
      // ✅ ENHANCED: Simple database call with automatic tenant filtering
      const { data, error } = await tenantDatabase.read('students', {}, 'id, full_name, email, class_id');
      
      if (error) throw error;
      
      setStudents(data || []);
      console.log(`✅ Loaded ${data?.length || 0} students for tenant: ${tenantName}`);
    } catch (err) {
      console.error('❌ Error loading students:', err);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isReady) {
      loadStudents();
    }
  }, [isReady]);

  if (isLoading || !isReady) {
    return <Text>Loading tenant data...</Text>;
  }

  if (error) {
    return <Text>Error: {error}</Text>;
  }

  return (
    <View>
      <Text>Students for {tenantName}</Text>
      <Text>Tenant ID: {getTenantId()}</Text>
      <Button title="Refresh Students" onPress={loadStudents} />
      {/* Render students list */}
    </View>
  );
};

/**
 * Example 2: Using enhanced database operations
 */
export const StudentService = {
  // ✅ ENHANCED: Create student with automatic tenant_id
  async createStudent(studentData) {
    try {
      console.log('📝 Creating student with enhanced tenant system...');
      
      const { data, error } = await tenantDatabase.create('students', {
        full_name: studentData.fullName,
        email: studentData.email,
        class_id: studentData.classId,
        parent_id: studentData.parentId
        // ✅ tenant_id is automatically added
      });
      
      if (error) throw error;
      
      console.log('✅ Student created successfully:', data.id);
      return { success: true, student: data };
    } catch (error) {
      console.error('❌ Error creating student:', error);
      return { success: false, error: error.message };
    }
  },

  // ✅ ENHANCED: Get students with automatic tenant filtering
  async getStudents(filters = {}) {
    try {
      console.log('📖 Getting students with enhanced tenant system...');
      
      const { data, error } = await tenantDatabase.read('students', filters, 
        'id, full_name, email, class_id, created_at'
      );
      
      if (error) throw error;
      
      console.log(`✅ Found ${data?.length || 0} students`);
      return { success: true, students: data || [] };
    } catch (error) {
      console.error('❌ Error getting students:', error);
      return { success: false, error: error.message };
    }
  },

  // ✅ ENHANCED: Update student with tenant validation
  async updateStudent(studentId, updates) {
    try {
      console.log('✏️ Updating student with enhanced tenant system...');
      
      const { data, error } = await tenantDatabase.update('students', studentId, updates);
      
      if (error) throw error;
      
      console.log('✅ Student updated successfully:', studentId);
      return { success: true, student: data };
    } catch (error) {
      console.error('❌ Error updating student:', error);
      return { success: false, error: error.message };
    }
  },

  // ✅ ENHANCED: Delete student with tenant validation
  async deleteStudent(studentId) {
    try {
      console.log('🗑️ Deleting student with enhanced tenant system...');
      
      const { error } = await tenantDatabase.delete('students', studentId);
      
      if (error) throw error;
      
      console.log('✅ Student deleted successfully:', studentId);
      return { success: true };
    } catch (error) {
      console.error('❌ Error deleting student:', error);
      return { success: false, error: error.message };
    }
  }
};

/**
 * Example 3: Replacing old tenantHelpers.getCurrentTenantId() calls
 */

// ❌ OLD WAY (unreliable, slow)
/*
const loadClassData = async () => {
  const tenantId = await tenantHelpers.getCurrentTenantId(); // Slow database call every time
  if (!tenantId) {
    throw new Error('No tenant ID');
  }
  
  const { data } = await supabase
    .from('classes')
    .select('*')
    .eq('tenant_id', tenantId);
  
  return data;
};
*/

// ✅ NEW WAY (reliable, fast)
const loadClassData = async () => {
  // Fast cached access, automatic tenant filtering
  const { data, error } = await tenantDatabase.read('classes');
  
  if (error) throw error;
  return data;
};

/**
 * Example 4: Service functions with enhanced tenant access
 */
export const AttendanceService = {
  async markAttendance(studentId, date, status) {
    return await tenantDatabase.create('student_attendance', {
      student_id: studentId,
      date: date,
      status: status,
      marked_at: new Date().toISOString()
      // tenant_id automatically added
    });
  },

  async getAttendanceByDate(date) {
    return await tenantDatabase.read('student_attendance', { date }, 
      'id, student_id, status, students(full_name)'
    );
  },

  async getStudentAttendance(studentId, startDate, endDate) {
    // For complex queries, you can still use the raw query builder
    const { getCachedTenantId, createTenantQuery } = require('../utils/tenantHelpers');
    
    const tenantId = getCachedTenantId();
    if (!tenantId) {
      throw new Error('No tenant context available');
    }

    const { data, error } = await createTenantQuery('student_attendance')
      .eq('student_id', studentId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    return { data, error };
  }
};

/**
 * Example 5: Component with tenant initialization check
 */
export const Dashboard = () => {
  const { isReady, isLoading, error, tenantName, initializeTenant } = useTenantAccess();
  const [dashboardData, setDashboardData] = useState(null);

  const retryInitialization = async () => {
    try {
      await initializeTenant();
    } catch (err) {
      Alert.alert('Error', 'Failed to initialize tenant data');
    }
  };

  useEffect(() => {
    if (isReady) {
      loadDashboardData();
    }
  }, [isReady]);

  const loadDashboardData = async () => {
    try {
      // All these calls use cached tenant ID automatically
      const [studentsResult, classesResult, teachersResult] = await Promise.all([
        tenantDatabase.read('students', {}, 'COUNT(*)'),
        tenantDatabase.read('classes', {}, 'COUNT(*)'),
        tenantDatabase.read('teachers', {}, 'COUNT(*)')
      ]);

      setDashboardData({
        studentCount: studentsResult.data?.[0]?.count || 0,
        classCount: classesResult.data?.[0]?.count || 0,
        teacherCount: teachersResult.data?.[0]?.count || 0
      });
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
    }
  };

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (error) {
    return (
      <View>
        <Text>Error: {error}</Text>
        <Button title="Retry" onPress={retryInitialization} />
      </View>
    );
  }

  if (!isReady) {
    return <Text>Tenant data not ready</Text>;
  }

  return (
    <View>
      <Text>Welcome to {tenantName}</Text>
      {dashboardData && (
        <View>
          <Text>Students: {dashboardData.studentCount}</Text>
          <Text>Classes: {dashboardData.classCount}</Text>
          <Text>Teachers: {dashboardData.teacherCount}</Text>
        </View>
      )}
    </View>
  );
};

export default {
  StudentListScreen,
  StudentService,
  AttendanceService,
  Dashboard
};