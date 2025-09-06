// Debug script to identify discount creation issues
// Run this with: node debug_discount_creation.js

console.log('🔍 DEBUG: Investigating discount creation issues...\n');

// Mock the required data for testing
const mockFormData = {
  classId: 'mock-class-id', // Replace with actual class ID
  studentId: 'mock-student-id', // Replace with actual student ID  
  discountValue: '500',
  feeComponent: 'Tuition Fee',
  description: 'Test discount',
  academicYear: '2024-25'
};

const mockTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';

console.log('📋 Form Data to be processed:');
console.log(JSON.stringify(mockFormData, null, 2));

console.log('\n🧮 Data validation checks:');

// Check 1: Discount value validation
console.log('\n1. Discount Value Validation:');
const discountValue = parseFloat(mockFormData.discountValue);
if (!mockFormData.discountValue || discountValue <= 0) {
  console.log('❌ VALIDATION ERROR: Invalid discount amount');
  console.log(`   - Provided value: "${mockFormData.discountValue}"`);
  console.log(`   - Parsed value: ${discountValue}`);
} else {
  console.log('✅ Discount value is valid:', discountValue);
}

// Check 2: Required fields
console.log('\n2. Required Fields Check:');
const requiredFields = ['classId', 'studentId'];
let missingFields = [];

requiredFields.forEach(field => {
  if (!mockFormData[field]) {
    missingFields.push(field);
  }
});

if (missingFields.length > 0) {
  console.log('❌ VALIDATION ERROR: Missing required fields');
  console.log('   - Missing fields:', missingFields);
} else {
  console.log('✅ All required fields are present');
}

// Check 3: Tenant context
console.log('\n3. Tenant Context Check:');
if (!mockTenantId) {
  console.log('❌ VALIDATION ERROR: No tenant context available');
} else {
  console.log('✅ Tenant ID available:', mockTenantId);
}

// Check 4: Data structure for database insert
console.log('\n4. Database Insert Data Structure:');
const insertData = {
  student_id: mockFormData.studentId,
  class_id: mockFormData.classId,
  academic_year: mockFormData.academicYear,
  discount_type: 'fixed_amount',
  discount_value: discountValue,
  fee_component: mockFormData.feeComponent || null,
  description: mockFormData.description,
  tenant_id: mockTenantId,
  is_active: true
};

console.log('Data to be inserted into student_discounts table:');
console.log(JSON.stringify(insertData, null, 2));

console.log('\n5. Field Type Validation:');
console.log('- student_id (uuid):', typeof insertData.student_id, '→', insertData.student_id);
console.log('- class_id (uuid):', typeof insertData.class_id, '→', insertData.class_id);
console.log('- academic_year (text):', typeof insertData.academic_year, '→', insertData.academic_year);
console.log('- discount_type (text):', typeof insertData.discount_type, '→', insertData.discount_type);
console.log('- discount_value (numeric):', typeof insertData.discount_value, '→', insertData.discount_value);
console.log('- fee_component (text):', typeof insertData.fee_component, '→', insertData.fee_component);
console.log('- description (text):', typeof insertData.description, '→', insertData.description);
console.log('- tenant_id (uuid):', typeof insertData.tenant_id, '→', insertData.tenant_id);
console.log('- is_active (boolean):', typeof insertData.is_active, '→', insertData.is_active);

console.log('\n🔍 Potential Issues to Check:');
console.log('\n🚨 MOST LIKELY ISSUES:');
console.log('1. Student ID does not exist in students table');
console.log('   → Check: SELECT id, name FROM students WHERE id = \'' + insertData.student_id + '\';');

console.log('\n2. Class ID does not exist in classes table');
console.log('   → Check: SELECT id, class_name FROM classes WHERE id = \'' + insertData.class_id + '\';');

console.log('\n3. Tenant ID mismatch');
console.log('   → Check: Student and Class belong to the same tenant');
console.log('   → Check: SELECT tenant_id FROM students WHERE id = \'' + insertData.student_id + '\';');
console.log('   → Check: SELECT tenant_id FROM classes WHERE id = \'' + insertData.class_id + '\';');

console.log('\n4. Row Level Security (RLS) Policies');
console.log('   → Check: User has permission to insert into student_discounts table');
console.log('   → Check: RLS policies on student_discounts table');

console.log('\n5. Database Connection Issues');
console.log('   → Check: Supabase connection is working');
console.log('   → Check: User is authenticated');

console.log('\n📝 TO DEBUG THIS ISSUE:');
console.log('1. Replace mock-class-id and mock-student-id with actual IDs from your database');
console.log('2. Run the actual discount creation from your app');
console.log('3. Check the exact error message in console.log');
console.log('4. Verify the student and class exist in your database');

console.log('\n🔧 SQL QUERIES TO RUN IN SUPABASE:');
console.log('\n-- Check if student exists');
console.log('SELECT id, name, class_id, tenant_id FROM students WHERE id = \'' + insertData.student_id + '\';');

console.log('\n-- Check if class exists');
console.log('SELECT id, class_name, tenant_id FROM classes WHERE id = \'' + insertData.class_id + '\';');

console.log('\n-- Check existing discounts for this student');
console.log('SELECT * FROM student_discounts WHERE student_id = \'' + insertData.student_id + '\' ORDER BY created_at DESC LIMIT 5;');

console.log('\n-- Test insert query (replace with actual IDs)');
console.log('INSERT INTO student_discounts (student_id, class_id, academic_year, discount_type, discount_value, fee_component, description, tenant_id, is_active)');
console.log('VALUES (\'' + insertData.student_id + '\', \'' + insertData.class_id + '\', \'' + insertData.academic_year + '\', \'' + insertData.discount_type + '\', ' + insertData.discount_value + ', \'' + insertData.fee_component + '\', \'' + insertData.description + '\', \'' + insertData.tenant_id + '\', ' + insertData.is_active + ');');

console.log('\n✨ Debug analysis complete. Check the error message and compare with the issues listed above.\n');
