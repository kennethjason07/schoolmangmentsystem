// Debug script to test role ID functionality
import { dbHelpers } from './src/utils/supabase.js';

async function testRoleIdSafely() {
  console.log('🧪 Testing getRoleIdSafely function...');
  
  try {
    // Test all role types
    const roles = ['admin', 'teacher', 'student', 'parent'];
    
    for (const role of roles) {
      console.log(`\n📋 Testing role: ${role}`);
      const roleId = await dbHelpers.getRoleIdSafely(role);
      console.log(`✅ Result for ${role}:`, roleId, 'Type:', typeof roleId);
      
      if (roleId === undefined || roleId === null) {
        console.error(`❌ PROBLEM: ${role} returned undefined/null!`);
      } else if (typeof roleId !== 'number') {
        console.error(`❌ PROBLEM: ${role} returned non-number:`, typeof roleId);
      } else {
        console.log(`✅ ${role} is valid: ${roleId}`);
      }
    }
    
    // Test invalid inputs
    console.log('\n📋 Testing invalid inputs:');
    const invalidInputs = [null, undefined, '', 123, {}, []];
    
    for (const input of invalidInputs) {
      console.log(`\n🔍 Testing invalid input:`, input);
      const roleId = await dbHelpers.getRoleIdSafely(input);
      console.log(`✅ Result:`, roleId, 'Type:', typeof roleId);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRoleIdSafely();
