#!/usr/bin/env node

// Debug script to test all account creation functions for role_id validation
const path = require('path');

// Mock the imports for testing
console.log('🔍 Testing all account creation functions for role_id validation...\n');

// Test 1: Test the getRoleIdSafely function itself
console.log('=== Test 1: getRoleIdSafely Function ===');

// Simulate the getRoleIdSafely function logic
function testGetRoleIdSafely(roleName) {
  const hardcodedRoles = {
    'admin': 1,
    'teacher': 2, 
    'parent': 3,
    'student': 4
  };
  
  console.log(`Testing getRoleIdSafely('${roleName}'):`);
  
  if (!roleName || typeof roleName !== 'string') {
    console.log(`  ❌ Invalid role name: ${roleName} (type: ${typeof roleName})`);
    const fallback = hardcodedRoles['admin'];
    console.log(`  🔄 Using fallback: ${fallback}`);
    return fallback;
  }
  
  const normalizedRole = roleName.toLowerCase().trim();
  const roleId = hardcodedRoles[normalizedRole];
  
  if (!roleId) {
    console.log(`  ❌ Role '${normalizedRole}' not found in hardcoded mapping`);
    const fallback = hardcodedRoles['admin'];
    console.log(`  🔄 Using fallback: ${fallback}`);
    return fallback;
  }
  
  console.log(`  ✅ Found role ID: ${roleId}`);
  return roleId;
}

// Test various inputs
const testInputs = [
  'admin',
  'teacher', 
  'parent',
  'student',
  'TEACHER', // uppercase
  ' teacher ', // with spaces
  null,
  undefined,
  '',
  'invalid_role',
  123, // number
  {}  // object
];

testInputs.forEach(input => {
  const result = testGetRoleIdSafely(input);
  console.log(`  Input: ${JSON.stringify(input)} → Result: ${result} (type: ${typeof result})\n`);
});

// Test 2: Simulate account creation validation
console.log('\n=== Test 2: Account Creation Role Validation ===');

function testAccountCreationValidation(userData, functionName) {
  console.log(`\nTesting ${functionName} with userData:`, userData);
  
  // Extract role_id from userData
  const roleId = userData?.role_id;
  console.log(`  Raw role_id: ${roleId} (type: ${typeof roleId})`);
  
  // Validation checks (mimicking the actual account creation functions)
  if (!roleId || roleId === undefined || roleId === null) {
    console.log(`  ❌ roleId is invalid: ${roleId}`);
    console.log(`  🚨 This would cause "invalid input syntax for type integer: undefined"`);
    return false;
  }
  
  if (typeof roleId !== 'number' || isNaN(roleId)) {
    console.log(`  ❌ roleId is not a valid number: ${roleId} (type: ${typeof roleId})`);
    console.log(`  🚨 This would cause database insertion issues`);
    return false;
  }
  
  console.log(`  ✅ roleId is valid: ${roleId}`);
  return true;
}

// Test scenarios that might occur
const testScenarios = [
  {
    name: 'Valid admin creation',
    userData: { role_id: 1, full_name: 'Admin User', email: 'admin@test.com' },
    function: 'createStudentAccount'
  },
  {
    name: 'Valid student creation',
    userData: { role_id: 4, full_name: 'Student User', email: 'student@test.com' },
    function: 'createStudentAccount'
  },
  {
    name: 'Undefined role_id (problem case)',
    userData: { role_id: undefined, full_name: 'Problem User', email: 'problem@test.com' },
    function: 'createStudentAccount'
  },
  {
    name: 'Null role_id (problem case)',
    userData: { role_id: null, full_name: 'Null User', email: 'null@test.com' },
    function: 'createStudentAccount'
  },
  {
    name: 'String role_id (problem case)',
    userData: { role_id: 'undefined', full_name: 'String User', email: 'string@test.com' },
    function: 'createStudentAccount'
  },
  {
    name: 'Missing role_id (problem case)',
    userData: { full_name: 'Missing Role User', email: 'missing@test.com' },
    function: 'createStudentAccount'
  }
];

testScenarios.forEach(scenario => {
  const isValid = testAccountCreationValidation(scenario.userData, scenario.function);
  console.log(`  Result: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
});

// Test 3: Check AuthContext signup validation
console.log('\n=== Test 3: AuthContext Signup Validation ===');

function testAuthContextSignup(userData) {
  console.log(`\nTesting AuthContext signup with:`, userData);
  
  // This mimics the validation in AuthContext.js line 515
  const safeRoleId = typeof userData.role_id === 'number' && !isNaN(userData.role_id) ? userData.role_id : 1;
  console.log(`  Original role_id: ${userData.role_id} (${typeof userData.role_id})`);
  console.log(`  Safe role_id: ${safeRoleId} (${typeof safeRoleId})`);
  
  if (userData.role_id !== safeRoleId) {
    console.log(`  ⚠️ Role ID was corrected from ${userData.role_id} to ${safeRoleId}`);
  }
  
  return safeRoleId;
}

// Test AuthContext scenarios
const authTestCases = [
  { role_id: 1 },
  { role_id: 'undefined' },
  { role_id: undefined },
  { role_id: null },
  { role_id: NaN },
  { role_id: '2' },
  { },  // missing role_id
];

authTestCases.forEach((testCase, index) => {
  const result = testAuthContextSignup(testCase);
  console.log(`  Test ${index + 1}: Input ${JSON.stringify(testCase.role_id)} → Output ${result}\n`);
});

console.log('\n=== Summary ===');
console.log('🔍 Based on testing, potential sources of undefined role_id:');
console.log('1. Direct database inserts bypassing validation');
console.log('2. Frontend passing undefined values');
console.log('3. Race conditions where role lookup fails');
console.log('4. String "undefined" being passed instead of actual undefined');
console.log('\n💡 To find the exact source:');
console.log('1. Add logging to all database insert operations');
console.log('2. Check network requests for role_id parameter');
console.log('3. Add validation before all .insert() calls');
console.log('4. Search for any hardcoded "undefined" strings in the codebase');

console.log('\n🔧 Next steps:');
console.log('1. Run the debug_role_test.js script to test getRoleIdSafely');
console.log('2. Add temporary logging to ALL database inserts');
console.log('3. Check browser/app logs during account creation');
