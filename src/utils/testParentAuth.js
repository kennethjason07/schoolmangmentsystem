/**
 * Test script to verify parent authentication works without tenant dependency
 * 
 * This script can be used to test the new parent authentication system
 * that bypasses tenant filtering and uses direct parent-student relationships.
 */

import { getParentStudents, getStudentForParent, isUserParent } from './parentAuthHelper';
import { supabase } from './supabase';

/**
 * Test parent authentication functionality
 * @param {string} testUserId - User ID to test with (optional, uses current user if not provided)
 */
export const testParentAuth = async (testUserId = null) => {
  console.log('🧪 [TEST] Starting parent authentication tests...');
  
  try {
    // Get current user if no test user provided
    let userId = testUserId;
    if (!userId) {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        console.error('❌ [TEST] No authenticated user found:', error?.message);
        return { success: false, error: 'No authenticated user' };
      }
      userId = user.id;
    }
    
    console.log('🔍 [TEST] Testing with user ID:', userId);
    
    // Test 1: Check if user is a parent
    console.log('\n=== TEST 1: Check if user is a parent ===');
    const parentCheck = await isUserParent(userId);
    console.log('Result:', parentCheck);
    
    if (!parentCheck.success) {
      console.error('❌ [TEST] Parent check failed:', parentCheck.error);
      return { success: false, error: parentCheck.error };
    }
    
    if (!parentCheck.isParent) {
      console.warn('⚠️ [TEST] User is not a parent - tests cannot continue');
      return { success: true, message: 'User is not a parent', isParent: false };
    }
    
    console.log('✅ [TEST] User is a parent with', parentCheck.studentCount, 'students');
    
    // Test 2: Get parent's students
    console.log('\n=== TEST 2: Get parent students ===');
    const studentsResult = await getParentStudents(userId);
    console.log('Result:', studentsResult);
    
    if (!studentsResult.success) {
      console.error('❌ [TEST] Failed to get parent students:', studentsResult.error);
      return { success: false, error: studentsResult.error };
    }
    
    const students = studentsResult.students;
    console.log('✅ [TEST] Successfully retrieved', students.length, 'students');
    students.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.name} (ID: ${student.id}, Class: ${student.full_class_name})`);
    });
    
    if (students.length === 0) {
      console.warn('⚠️ [TEST] No students found - remaining tests skipped');
      return { success: true, message: 'No students found', studentCount: 0 };
    }
    
    // Test 3: Get specific student details
    console.log('\n=== TEST 3: Get specific student details ===');
    const firstStudent = students[0];
    const studentResult = await getStudentForParent(userId, firstStudent.id);
    console.log('Result:', studentResult);
    
    if (!studentResult.success) {
      console.error('❌ [TEST] Failed to get student details:', studentResult.error);
      return { success: false, error: studentResult.error };
    }
    
    console.log('✅ [TEST] Successfully retrieved student details for:', studentResult.student.name);
    console.log('   Class:', studentResult.student.full_class_name);
    console.log('   Admission No:', studentResult.student.admission_no || 'N/A');
    
    // Test 4: Test access control (try to access a random student)
    console.log('\n=== TEST 4: Test access control ===');
    const randomStudentId = 'random-student-id-that-should-not-exist';
    const accessTest = await getStudentForParent(userId, randomStudentId);
    console.log('Access test result:', accessTest);
    
    if (accessTest.success) {
      console.error('❌ [TEST] Access control failed - should not have access to random student');
      return { success: false, error: 'Access control failed' };
    } else {
      console.log('✅ [TEST] Access control working - correctly denied access to unauthorized student');
    }
    
    console.log('\n🎉 [TEST] All parent authentication tests passed!');
    return {
      success: true,
      message: 'All tests passed',
      studentCount: students.length,
      primaryStudent: firstStudent.name
    };
    
  } catch (error) {
    console.error('💥 [TEST] Unexpected error during testing:', error);
    return {
      success: false,
      error: `Test failed with error: ${error.message}`
    };
  }
};

/**
 * Quick test function that can be called from the browser console
 */
export const quickParentAuthTest = async () => {
  console.log('🚀 [QUICK TEST] Starting quick parent auth test...');
  const result = await testParentAuth();
  
  if (result.success) {
    console.log('✅ [QUICK TEST] Parent authentication is working!');
    if (result.isParent === false) {
      console.log('ℹ️ [QUICK TEST] Current user is not a parent');
    } else {
      console.log('👨‍👩‍👧 [QUICK TEST] Found', result.studentCount, 'students for current user');
      if (result.primaryStudent) {
        console.log('🎓 [QUICK TEST] Primary student:', result.primaryStudent);
      }
    }
  } else {
    console.error('❌ [QUICK TEST] Parent authentication test failed:', result.error);
  }
  
  return result;
};

// Make the test function available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.testParentAuth = testParentAuth;
  window.quickParentAuthTest = quickParentAuthTest;
}
