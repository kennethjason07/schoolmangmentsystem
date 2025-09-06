import { supabase } from './src/utils/supabase.js';
import { calculateStudentFees } from './src/utils/feeCalculation.js';

/**
 * COMPREHENSIVE TEST: Simplified Fee Management System
 * 
 * This script tests the new simplified fee management architecture:
 * 1. fee_structure contains ONLY class-level fees (student_id = null)
 * 2. student_discounts table manages individual student discounts  
 * 3. Fee calculations done dynamically (class fees - applicable discounts)
 */

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
  console.log('🧪 Starting comprehensive test of simplified fee system...');
  console.log('=' .repeat(70));
  
  try {
    // Test 1: Verify no student-specific fee entries exist
    console.log('\n🔍 TEST 1: Verify Database Cleanup');
    const { count: studentSpecificCount, error: cleanupError } = await supabase
      .from('fee_structure')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null)
      .eq('tenant_id', TENANT_ID);
    
    logTest('Database cleanup verification', 
      !cleanupError && (studentSpecificCount === 0 || studentSpecificCount === null),
      `Found ${studentSpecificCount || 0} student-specific entries (should be 0)`
    );
    
    // Test 2: Verify class-level fees exist
    console.log('\n🏢 TEST 2: Verify Class-Level Fee Structure');
    const { data: classLevelFees, error: classFeesError } = await supabase
      .from('fee_structure')
      .select('*')
      .is('student_id', null)
      .eq('tenant_id', TENANT_ID)
      .limit(5);
    
    logTest('Class-level fees existence', 
      !classFeesError && classLevelFees && classLevelFees.length > 0,
      `Found ${classLevelFees?.length || 0} class-level fee structures`
    );
    
    if (classLevelFees && classLevelFees.length > 0) {
      console.log('   📋 Sample class fees:');
      classLevelFees.forEach((fee, idx) => {
        console.log(`     ${idx + 1}. Class ${fee.class_id}: ${fee.fee_component} = ₹${fee.amount} (student_id: ${fee.student_id || 'null'})`);
      });
    }
    
    // Test 3: Get sample student and class data
    console.log('\n👥 TEST 3: Get Sample Student Data');
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id')
      .eq('tenant_id', TENANT_ID)
      .limit(3);
    
    logTest('Sample student data retrieval', 
      !studentsError && students && students.length > 0,
      `Found ${students?.length || 0} students for testing`
    );
    
    if (!students || students.length === 0) {
      console.log('⚠️ No students found, skipping student-specific tests');
      return;
    }
    
    const testStudent = students[0];
    console.log(`   🎯 Using test student: ${testStudent.name} (ID: ${testStudent.id}, Class: ${testStudent.class_id})`);
    
    // Test 4: Test fee calculation without discounts
    console.log('\n💰 TEST 4: Fee Calculation Without Discounts');
    try {
      const feeCalc = await calculateStudentFees(testStudent.id, testStudent.class_id, TENANT_ID);
      
      logTest('Basic fee calculation', 
        feeCalc && !feeCalc.error && typeof feeCalc.totalAmount === 'number',
        `Student ${testStudent.name}: Base fees = ₹${feeCalc.totalAmount}, Discounts = ₹${feeCalc.totalDiscounts}`
      );
      
      if (feeCalc && feeCalc.details) {
        console.log('   📋 Fee breakdown:');
        feeCalc.details.forEach((detail, idx) => {
          console.log(`     ${idx + 1}. ${detail.feeComponent}: Base ₹${detail.baseFeeAmount}, Final ₹${detail.finalAmount}`);
          console.log(`        Class Fee: ${detail.isClassFee}, Individual Fee: ${detail.isIndividualFee}`);
        });
      }
      
      // Test 5: Create a test discount
      console.log('\n🎁 TEST 5: Create Student Discount');
      const discountData = {
        student_id: testStudent.id,
        class_id: testStudent.class_id,
        academic_year: '2024-25',
        discount_type: 'fixed_amount',
        discount_value: 500,
        fee_component: null, // Apply to all components
        reason: 'Test discount for simplified system',
        is_active: true,
        tenant_id: TENANT_ID
      };
      
      const { data: discountResult, error: discountError } = await supabase
        .from('student_discounts')
        .insert(discountData)
        .select()
        .single();
      
      logTest('Student discount creation', 
        !discountError && discountResult,
        `Created ₹${discountData.discount_value} discount for ${testStudent.name}`
      );
      
      if (discountResult) {
        // Test 6: Test fee calculation WITH discounts
        console.log('\n💸 TEST 6: Fee Calculation With Discounts');
        const feeCalcWithDiscount = await calculateStudentFees(testStudent.id, testStudent.class_id, TENANT_ID);
        
        const expectedTotal = feeCalc.totalAmount - discountData.discount_value;
        const discountApplied = feeCalc.totalAmount - feeCalcWithDiscount.totalAmount;
        
        logTest('Fee calculation with discounts', 
          feeCalcWithDiscount && !feeCalcWithDiscount.error && discountApplied > 0,
          `Original: ₹${feeCalc.totalAmount}, With Discount: ₹${feeCalcWithDiscount.totalAmount}, Applied: ₹${discountApplied}`
        );
        
        logTest('Discount amount verification', 
          Math.abs(discountApplied - discountData.discount_value) < 1, // Allow for small rounding differences
          `Expected ₹${discountData.discount_value}, Got ₹${discountApplied}`
        );
        
        if (feeCalcWithDiscount && feeCalcWithDiscount.details) {
          console.log('   📋 Fee breakdown with discounts:');
          feeCalcWithDiscount.details.forEach((detail, idx) => {
            console.log(`     ${idx + 1}. ${detail.feeComponent}: Base ₹${detail.baseFeeAmount}, Discount ₹${detail.discountAmount}, Final ₹${detail.finalAmount}`);
            if (detail.discounts && detail.discounts.length > 0) {
              detail.discounts.forEach(discount => {
                console.log(`        🎁 Discount: ${discount.discount_type} ₹${discount.discount_value} (${discount.reason})`);
              });
            }
          });
        }
        
        // Test 7: Verify no student-specific fee entries were created
        console.log('\n🔒 TEST 7: Verify No Student-Specific Fee Entries Created');
        const { count: newStudentEntriesCount, error: verifyError } = await supabase
          .from('fee_structure')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', testStudent.id)
          .eq('tenant_id', TENANT_ID);
        
        logTest('No student-specific fee entries created', 
          !verifyError && (newStudentEntriesCount === 0 || newStudentEntriesCount === null),
          `Found ${newStudentEntriesCount || 0} student-specific entries (should still be 0)`
        );
        
        // Test 8: Test discount management functions
        console.log('\n⚙️ TEST 8: Test Discount Management Functions');
        
        // Test update discount
        const { error: updateError } = await supabase
          .from('student_discounts')
          .update({ discount_value: 750, reason: 'Updated test discount' })
          .eq('id', discountResult.id);
        
        logTest('Update discount', 
          !updateError,
          updateError ? updateError.message : 'Discount updated successfully'
        );
        
        // Test fee calculation after discount update
        const feeCalcUpdated = await calculateStudentFees(testStudent.id, testStudent.class_id, TENANT_ID);
        const newDiscountApplied = feeCalc.totalAmount - feeCalcUpdated.totalAmount;
        
        logTest('Fee calculation after discount update', 
          Math.abs(newDiscountApplied - 750) < 1,
          `Updated discount applied: ₹${newDiscountApplied} (expected ₹750)`
        );
        
        // Cleanup: Remove test discount
        console.log('\n🧹 CLEANUP: Removing Test Data');
        const { error: cleanupDiscountError } = await supabase
          .from('student_discounts')
          .delete()
          .eq('id', discountResult.id);
        
        logTest('Test discount cleanup', 
          !cleanupDiscountError,
          cleanupDiscountError ? cleanupDiscountError.message : 'Test discount removed successfully'
        );
        
        // Final verification - fee calculation should be back to original
        const finalFeeCalc = await calculateStudentFees(testStudent.id, testStudent.class_id, TENANT_ID);
        logTest('Fee calculation after cleanup', 
          Math.abs(finalFeeCalc.totalAmount - feeCalc.totalAmount) < 1,
          `Final total: ₹${finalFeeCalc.totalAmount} (should match original ₹${feeCalc.totalAmount})`
        );
      }
      
    } catch (calcError) {
      logTest('Fee calculation', false, `Error: ${calcError.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    logTest('Test execution', false, error.message);
  }
  
  // Print final results
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL TEST RESULTS');
  console.log('='.repeat(70));
  console.log(`✅ Tests Passed: ${testResults.passed}`);
  console.log(`❌ Tests Failed: ${testResults.failed}`);
  console.log(`📊 Success Rate: ${testResults.passed + testResults.failed > 0 ? Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100) : 0}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests.filter(test => !test.passed).forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  } else {
    console.log('\n🎉 All tests passed! The simplified fee system is working correctly.');
    console.log('\n✨ System Benefits:');
    console.log('   ✅ Clean architecture: Only class-level fees in fee_structure');
    console.log('   ✅ Flexible discounts: Individual discounts in student_discounts table');
    console.log('   ✅ Dynamic calculation: Fees calculated on-the-fly');
    console.log('   ✅ No data duplication: No redundant student-specific fee entries');
    console.log('   ✅ Easy maintenance: Changes to class fees affect all students automatically');
  }
}

// Run the comprehensive test
testSimplifiedFeeSystem()
  .then(() => {
    console.log('\n🏁 Test execution completed');
    process.exit(testResults.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
