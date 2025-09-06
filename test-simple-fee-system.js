import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create simple Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TENANT_ID = 'b8f8b5f0-1234-4567-8901-123456789000';

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (details) console.log(`   📝 ${details}`);
  
  testResults.tests.push({ name: testName, passed, details });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function testSimplifiedFeeSystem() {
  console.log('🧪 Testing simplified fee system...');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Verify no student-specific fee entries exist
    console.log('\n🔍 TEST 1: Database Cleanup Verification');
    const { count: studentSpecificCount, error: cleanupError } = await supabase
      .from('fee_structure')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null)
      .eq('tenant_id', TENANT_ID);
    
    logTest('No student-specific fee entries', 
      !cleanupError && (studentSpecificCount === 0 || studentSpecificCount === null),
      `Found ${studentSpecificCount || 0} student-specific entries (should be 0)`
    );
    
    // Test 2: Verify class-level fees exist
    console.log('\n🏢 TEST 2: Class-Level Fee Structure');
    const { data: classLevelFees, error: classFeesError } = await supabase
      .from('fee_structure')
      .select('*')
      .is('student_id', null)
      .eq('tenant_id', TENANT_ID)
      .limit(5);
    
    logTest('Class-level fees exist', 
      !classFeesError && classLevelFees && classLevelFees.length > 0,
      `Found ${classLevelFees?.length || 0} class-level fee structures`
    );
    
    if (classLevelFees && classLevelFees.length > 0) {
      console.log('   📋 Sample class fees:');
      classLevelFees.forEach((fee, idx) => {
        console.log(`     ${idx + 1}. Class ${fee.class_id}: ${fee.fee_component} = ₹${fee.amount} (student_id: ${fee.student_id || 'null'})`);
      });
    }
    
    // Test 3: Check student data availability
    console.log('\n👥 TEST 3: Student Data Check');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id')
      .eq('tenant_id', TENANT_ID)
      .limit(3);
    
    logTest('Student data available', 
      !studentsError && students && students.length > 0,
      `Found ${students?.length || 0} students`
    );
    
    if (!students || students.length === 0) {
      console.log('⚠️ No students found for detailed testing');
      return;
    }
    
    const testStudent = students[0];
    console.log(`   🎯 Test student: ${testStudent.name} (ID: ${testStudent.id}, Class: ${testStudent.class_id})`);
    
    // Test 4: Student discount functionality 
    console.log('\n🎁 TEST 4: Student Discount Management');
    
    // Create test discount
    const discountData = {
      student_id: testStudent.id,
      class_id: testStudent.class_id,
      academic_year: '2024-25',
      discount_type: 'fixed_amount',
      discount_value: 500,
      fee_component: null,
      reason: 'Test discount - simplified system validation',
      is_active: true,
      tenant_id: TENANT_ID
    };
    
    const { data: discountResult, error: discountError } = await supabase
      .from('student_discounts')
      .insert(discountData)
      .select()
      .single();
    
    logTest('Create student discount', 
      !discountError && discountResult,
      discountError ? discountError.message : `Created ₹${discountData.discount_value} discount`
    );
    
    if (discountResult) {
      // Test 5: Verify discount in database
      console.log('\n🔍 TEST 5: Discount Verification');
      const { data: fetchedDiscount, error: fetchError } = await supabase
        .from('student_discounts')
        .select('*')
        .eq('id', discountResult.id)
        .single();
      
      logTest('Discount data integrity', 
        !fetchError && fetchedDiscount && fetchedDiscount.discount_value === 500,
        `Retrieved discount: ₹${fetchedDiscount?.discount_value || 0}`
      );
      
      // Test 6: Update discount
      console.log('\n⚙️ TEST 6: Discount Management');
      const { error: updateError } = await supabase
        .from('student_discounts')
        .update({ discount_value: 750, reason: 'Updated test discount' })
        .eq('id', discountResult.id);
      
      logTest('Update discount', 
        !updateError,
        updateError ? updateError.message : 'Discount updated to ₹750'
      );
      
      // Test 7: Verify no student-specific fee entries created
      console.log('\n🔒 TEST 7: Architecture Integrity');
      const { count: newStudentEntries, error: verifyError } = await supabase
        .from('fee_structure')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', testStudent.id)
        .eq('tenant_id', TENANT_ID);
      
      logTest('No student-specific fee entries created', 
        !verifyError && (newStudentEntries === 0 || newStudentEntries === null),
        `Found ${newStudentEntries || 0} student-specific entries (architecture maintains clean separation)`
      );
      
      // Test 8: Check total discounts in system
      console.log('\n📊 TEST 8: System State Check');
      const { count: totalDiscounts, error: totalError } = await supabase
        .from('student_discounts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true);
      
      logTest('Active discounts tracking', 
        !totalError && totalDiscounts >= 1,
        `Found ${totalDiscounts || 0} active discounts in system`
      );
      
      // Cleanup: Remove test discount
      console.log('\n🧹 CLEANUP');
      const { error: deleteError } = await supabase
        .from('student_discounts')
        .delete()
        .eq('id', discountResult.id);
      
      logTest('Cleanup test discount', 
        !deleteError,
        deleteError ? deleteError.message : 'Test discount removed successfully'
      );
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    logTest('Test execution', false, error.message);
  }
  
  // Print results
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Success Rate: ${testResults.passed + testResults.failed > 0 ? Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100) : 0}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests.filter(test => !test.passed).forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  } else {
    console.log('\n🎉 SUCCESS! Simplified fee system is working correctly.');
    console.log('\n✨ Verified Features:');
    console.log('   ✅ Clean database: No student-specific fee_structure entries');
    console.log('   ✅ Class-level fees: Only class fees in fee_structure table');
    console.log('   ✅ Discount management: student_discounts table working properly');
    console.log('   ✅ Data integrity: Architecture maintains separation of concerns');
    console.log('   ✅ CRUD operations: Create, read, update, delete discounts working');
  }
}

// Run test
testSimplifiedFeeSystem()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(testResults.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
