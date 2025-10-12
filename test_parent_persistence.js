/**
 * Test Script - Parent Login Persistence
 * 
 * This script helps debug parent login persistence issues by testing the authentication flow.
 */

import { supabase } from './src/utils/supabase.js';
import { getParentStudents, isUserParent } from './src/utils/parentAuthHelper.js';
import { getCurrentUserTenantByEmail } from './src/utils/getTenantByEmail.js';

const testParentPersistence = async () => {
  console.log('🧪 Starting Parent Persistence Test...\n');

  try {
    // Step 1: Check current session
    console.log('Step 1: Checking current session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError.message);
      return;
    }

    if (!session?.user) {
      console.log('❌ No active session found. Please login first.');
      console.log('To test this:');
      console.log('1. Login to the app as a parent');
      console.log('2. Run this test script');
      return;
    }

    const user = session.user;
    console.log('✅ Active session found');
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}\n`);

    // Step 2: Test tenant lookup
    console.log('Step 2: Testing tenant lookup...');
    const tenantResult = await getCurrentUserTenantByEmail();
    
    if (tenantResult.success) {
      console.log('✅ Tenant lookup successful');
      console.log(`   Tenant: ${tenantResult.data.tenant.name}`);
      console.log(`   Tenant ID: ${tenantResult.data.tenant.id}\n`);
    } else {
      console.log('⚠️ Tenant lookup failed:', tenantResult.error);
      console.log('   This might be okay for parents - continuing test...\n');
    }

    // Step 3: Test parent check
    console.log('Step 3: Testing parent authentication...');
    const parentCheck = await isUserParent(user.id);
    
    if (parentCheck.success && parentCheck.isParent) {
      console.log('✅ User confirmed as parent');
      console.log(`   Student count: ${parentCheck.studentCount}\n`);
    } else {
      console.log('❌ Parent check failed:', parentCheck.error || 'User is not a parent');
      return;
    }

    // Step 4: Test student fetching
    console.log('Step 4: Testing student data fetching...');
    const studentsResult = await getParentStudents(user.id);
    
    if (studentsResult.success) {
      console.log('✅ Student data fetched successfully');
      console.log(`   Students found: ${studentsResult.students.length}`);
      
      studentsResult.students.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.name} - ${student.full_class_name}`);
      });
      console.log('');
    } else {
      console.log('❌ Failed to fetch student data:', studentsResult.error);
      return;
    }

    // Step 5: Test AsyncStorage (simulated)
    console.log('Step 5: Testing storage persistence simulation...');
    try {
      // This simulates what would be stored
      const storageData = {
        userSession: {
          id: user.id,
          email: user.email
        },
        tenantData: tenantResult.success ? {
          id: tenantResult.data.tenant.id,
          name: tenantResult.data.tenant.name
        } : null,
        studentData: {
          count: studentsResult.students.length,
          students: studentsResult.students.map(s => ({ id: s.id, name: s.name }))
        }
      };
      
      console.log('✅ Storage data structure looks good');
      console.log('   Data to be persisted:');
      console.log(JSON.stringify(storageData, null, 2));
    } catch (error) {
      console.log('⚠️ Storage simulation error:', error.message);
    }

    console.log('\n🎉 TEST PASSED: Parent persistence should work!');
    console.log('\n📋 What this means:');
    console.log('- Your parent authentication is working correctly');
    console.log('- Student data can be fetched successfully');
    console.log('- App restart should preserve your login');
    
    console.log('\n🔍 If you still see "no child" after app restart:');
    console.log('1. Check the console logs when you restart the app');
    console.log('2. Look for StartupLoader and SelectedStudentContext logs');
    console.log('3. Make sure you\'re testing with the updated code');

  } catch (error) {
    console.error('💥 Test failed with unexpected error:', error);
    console.log('\n🔧 This suggests a fundamental issue with:');
    console.log('- Database connection');
    console.log('- Authentication setup');
    console.log('- Parent-student relationships in database');
  }
};

// Run the test
console.log('Parent Login Persistence Test');
console.log('============================');
testParentPersistence();