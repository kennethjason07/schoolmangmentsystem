/**
 * 🧪 DYNAMIC FEE CALCULATION TESTS
 * 
 * This test suite validates the new dynamic fee calculation system where:
 * - fee_structure contains only class-level fees (student_id = null)
 * - student_discounts contains individual student discounts
 * - Fees are calculated dynamically at runtime
 * 
 * Run these tests to ensure the system works as expected.
 */

import { supabase, calculateStudentFeesWithDiscounts, createClassFee, updateClassFee, getFeeStructure } from '../utils/supabase';
import FeeService from '../services/FeeService';

// Test configuration
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_CLASS_ID = 'test-class-456';
const TEST_STUDENT_1_ID = 'test-student-001';
const TEST_STUDENT_2_ID = 'test-student-002';
const ACADEMIC_YEAR = '2024-2025';

/**
 * 🏗️ Setup Test Data
 */
async function setupTestData() {
  console.log('📋 Setting up test data...');
  
  try {
    // 1. Create test class fees (class-level only)
    const testClassFees = [
      {
        id: 'fee-tuition-001',
        tenant_id: TEST_TENANT_ID,
        class_id: TEST_CLASS_ID,
        student_id: null, // ✅ Class-level fee
        fee_component: 'Tuition Fee',
        amount: 15000,
        base_amount: 15000, // ✅ base_amount equals amount
        academic_year: ACADEMIC_YEAR,
        due_date: '2024-12-31'
      },
      {
        id: 'fee-library-002',
        tenant_id: TEST_TENANT_ID,
        class_id: TEST_CLASS_ID,
        student_id: null, // ✅ Class-level fee
        fee_component: 'Library Fee',
        amount: 3000,
        base_amount: 3000, // ✅ base_amount equals amount
        academic_year: ACADEMIC_YEAR,
        due_date: '2024-10-31'
      },
      {
        id: 'fee-transport-003',
        tenant_id: TEST_TENANT_ID,
        class_id: TEST_CLASS_ID,
        student_id: null, // ✅ Class-level fee
        fee_component: 'Transport Fee',
        amount: 8000,
        base_amount: 8000, // ✅ base_amount equals amount
        academic_year: ACADEMIC_YEAR,
        due_date: '2024-11-30'
      }
    ];

    // Insert class fees
    const { error: feeError } = await supabase
      .from('fee_structure')
      .upsert(testClassFees);
    
    if (feeError) {
      console.error('❌ Error creating test fees:', feeError);
      return false;
    }

    // 2. Create test student discounts
    const testDiscounts = [
      {
        id: 'discount-student1-001',
        tenant_id: TEST_TENANT_ID,
        student_id: TEST_STUDENT_1_ID,
        fee_component: 'Tuition Fee',
        discount_type: 'percentage',
        discount_value: 10, // 10% discount on tuition
        reason: 'Merit scholarship',
        academic_year: ACADEMIC_YEAR,
        is_active: true
      },
      {
        id: 'discount-student2-001',
        tenant_id: TEST_TENANT_ID,
        student_id: TEST_STUDENT_2_ID,
        fee_component: 'Library Fee',
        discount_type: 'fixed',
        discount_value: 1000, // ₹1000 fixed discount on library
        reason: 'Sibling discount',
        academic_year: ACADEMIC_YEAR,
        is_active: true
      }
    ];

    const { error: discountError } = await supabase
      .from('student_discounts')
      .upsert(testDiscounts);
    
    if (discountError) {
      console.error('❌ Error creating test discounts:', discountError);
      return false;
    }

    console.log('✅ Test data setup complete');
    return true;
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return false;
  }
}

/**
 * 🧪 Test 1: Class Fee Structure Integrity
 */
async function testClassFeeStructureIntegrity() {
  console.log('\n🧪 TEST 1: Class Fee Structure Integrity');
  
  try {
    // Fetch all fees for the test class
    const { data: classFees, error } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', TEST_CLASS_ID)
      .eq('academic_year', ACADEMIC_YEAR);

    if (error) {
      console.error('❌ Error fetching class fees:', error);
      return false;
    }

    // Validate class fee structure
    let allValid = true;
    
    classFees.forEach(fee => {
      console.log(`   Checking fee: ${fee.fee_component}`);
      
      // Check 1: All fees should have student_id = null
      if (fee.student_id !== null) {
        console.error(`   ❌ Fee has student_id: ${fee.student_id} (should be null)`);
        allValid = false;
      }
      
      // Check 2: base_amount should equal amount
      if (fee.base_amount !== fee.amount) {
        console.error(`   ❌ base_amount (${fee.base_amount}) ≠ amount (${fee.amount})`);
        allValid = false;
      }
      
      // Check 3: Required fields
      if (!fee.fee_component || !fee.amount || !fee.class_id) {
        console.error(`   ❌ Missing required fields`);
        allValid = false;
      }
    });

    if (allValid) {
      console.log('✅ Class fee structure integrity: PASSED');
      console.log(`   - Found ${classFees.length} class-level fees`);
      console.log(`   - All fees have student_id = null`);
      console.log(`   - All fees have base_amount = amount`);
      return true;
    } else {
      console.log('❌ Class fee structure integrity: FAILED');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 🧪 Test 2: Dynamic Fee Calculation for Student with Discounts
 */
async function testDynamicCalculationWithDiscounts() {
  console.log('\n🧪 TEST 2: Dynamic Calculation - Student with Discounts');
  
  try {
    // Test Student 1 (has 10% discount on tuition)
    const result = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_1_ID);
    
    if (!result.success) {
      console.error('❌ FeeService failed:', result.error);
      return false;
    }

    const { fees } = result.data;
    console.log(`   Student fees calculated: ${fees.components.length} components`);
    
    // Find tuition fee component
    const tuitionFee = fees.components.find(c => c.component === 'Tuition Fee');
    if (!tuitionFee) {
      console.error('❌ Tuition fee component not found');
      return false;
    }
    
    // Validate calculations
    const expectedDiscount = 15000 * 0.10; // 10% of ₹15000 = ₹1500
    const expectedFinalAmount = 15000 - expectedDiscount; // ₹13500
    
    console.log(`   Tuition Fee Analysis:`);
    console.log(`   - Base fee amount: ₹${tuitionFee.baseFeeAmount}`);
    console.log(`   - Discount amount: ₹${tuitionFee.discountAmount}`);
    console.log(`   - Final amount: ₹${tuitionFee.finalAmount}`);
    console.log(`   - Expected discount: ₹${expectedDiscount}`);
    console.log(`   - Expected final: ₹${expectedFinalAmount}`);
    
    // Validate calculations
    if (tuitionFee.baseFeeAmount !== 15000) {
      console.error(`❌ Incorrect base fee: ${tuitionFee.baseFeeAmount}, expected: 15000`);
      return false;
    }
    
    if (Math.abs(tuitionFee.discountAmount - expectedDiscount) > 0.01) {
      console.error(`❌ Incorrect discount: ${tuitionFee.discountAmount}, expected: ${expectedDiscount}`);
      return false;
    }
    
    if (Math.abs(tuitionFee.finalAmount - expectedFinalAmount) > 0.01) {
      console.error(`❌ Incorrect final amount: ${tuitionFee.finalAmount}, expected: ${expectedFinalAmount}`);
      return false;
    }
    
    // Check that other fees have no discounts
    const libraryFee = fees.components.find(c => c.component === 'Library Fee');
    if (libraryFee && libraryFee.discountAmount !== 0) {
      console.error(`❌ Library fee should have no discount: ${libraryFee.discountAmount}`);
      return false;
    }
    
    console.log('✅ Dynamic calculation with discounts: PASSED');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 🧪 Test 3: Dynamic Fee Calculation for Student without Discounts
 */
async function testDynamicCalculationWithoutDiscounts() {
  console.log('\n🧪 TEST 3: Dynamic Calculation - Student without General Discounts');
  
  try {
    // Test Student 2 (has specific library discount, but tuition should be full price)
    const result = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_2_ID);
    
    if (!result.success) {
      console.error('❌ FeeService failed:', result.error);
      return false;
    }

    const { fees } = result.data;
    
    // Find tuition fee (should be full price for Student 2)
    const tuitionFee = fees.components.find(c => c.component === 'Tuition Fee');
    if (!tuitionFee) {
      console.error('❌ Tuition fee component not found');
      return false;
    }
    
    console.log(`   Tuition Fee Analysis for Student 2:`);
    console.log(`   - Base fee amount: ₹${tuitionFee.baseFeeAmount}`);
    console.log(`   - Discount amount: ₹${tuitionFee.discountAmount}`);
    console.log(`   - Final amount: ₹${tuitionFee.finalAmount}`);
    
    // Student 2 should pay full tuition (no discount)
    if (tuitionFee.discountAmount !== 0) {
      console.error(`❌ Student 2 should have no tuition discount: ${tuitionFee.discountAmount}`);
      return false;
    }
    
    if (tuitionFee.finalAmount !== tuitionFee.baseFeeAmount) {
      console.error(`❌ Final amount should equal base amount: ${tuitionFee.finalAmount} vs ${tuitionFee.baseFeeAmount}`);
      return false;
    }
    
    // But library fee should have discount
    const libraryFee = fees.components.find(c => c.component === 'Library Fee');
    if (!libraryFee) {
      console.error('❌ Library fee component not found');
      return false;
    }
    
    console.log(`   Library Fee Analysis for Student 2:`);
    console.log(`   - Base fee amount: ₹${libraryFee.baseFeeAmount}`);
    console.log(`   - Discount amount: ₹${libraryFee.discountAmount}`);
    console.log(`   - Final amount: ₹${libraryFee.finalAmount}`);
    
    if (libraryFee.discountAmount !== 1000) {
      console.error(`❌ Library discount should be ₹1000: ${libraryFee.discountAmount}`);
      return false;
    }
    
    console.log('✅ Dynamic calculation without general discounts: PASSED');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 🧪 Test 4: Discount Deletion and Fee Restoration
 */
async function testDiscountDeletionRestoration() {
  console.log('\n🧪 TEST 4: Discount Deletion and Fee Restoration');
  
  try {
    // Step 1: Get fees with discount
    let result = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_1_ID);
    if (!result.success) {
      console.error('❌ Initial FeeService failed:', result.error);
      return false;
    }
    
    let tuitionFee = result.data.fees.components.find(c => c.component === 'Tuition Fee');
    const initialFinalAmount = tuitionFee.finalAmount;
    const initialDiscountAmount = tuitionFee.discountAmount;
    
    console.log(`   Before deletion:`);
    console.log(`   - Final amount: ₹${initialFinalAmount}`);
    console.log(`   - Discount amount: ₹${initialDiscountAmount}`);
    
    // Step 2: Delete the discount
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('student_id', TEST_STUDENT_1_ID)
      .eq('fee_component', 'Tuition Fee');
    
    if (deleteError) {
      console.error('❌ Error deleting discount:', deleteError);
      return false;
    }
    
    console.log('   ✅ Discount deleted from student_discounts table');
    
    // Step 3: Get fees after deletion (should revert to class fees)
    result = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_1_ID);
    if (!result.success) {
      console.error('❌ Post-deletion FeeService failed:', result.error);
      return false;
    }
    
    tuitionFee = result.data.fees.components.find(c => c.component === 'Tuition Fee');
    const afterFinalAmount = tuitionFee.finalAmount;
    const afterDiscountAmount = tuitionFee.discountAmount;
    
    console.log(`   After deletion:`);
    console.log(`   - Final amount: ₹${afterFinalAmount}`);
    console.log(`   - Discount amount: ₹${afterDiscountAmount}`);
    
    // Step 4: Validate restoration
    if (afterDiscountAmount !== 0) {
      console.error(`❌ Discount should be 0 after deletion: ${afterDiscountAmount}`);
      return false;
    }
    
    if (afterFinalAmount !== tuitionFee.baseFeeAmount) {
      console.error(`❌ Final amount should equal base fee: ${afterFinalAmount} vs ${tuitionFee.baseFeeAmount}`);
      return false;
    }
    
    if (afterFinalAmount !== 15000) {
      console.error(`❌ Final amount should be ₹15000: ${afterFinalAmount}`);
      return false;
    }
    
    console.log('✅ Discount deletion and fee restoration: PASSED');
    console.log('   - Discount successfully removed');
    console.log('   - Fees automatically reverted to class amount');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 🧪 Test 5: Class Fee Modification Affects All Students
 */
async function testClassFeeModification() {
  console.log('\n🧪 TEST 5: Class Fee Modification Affects All Students');
  
  try {
    // Step 1: Get initial fees for both students
    const student1Initial = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_1_ID);
    const student2Initial = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_2_ID);
    
    if (!student1Initial.success || !student2Initial.success) {
      console.error('❌ Initial fee fetch failed');
      return false;
    }
    
    // Step 2: Modify class fee (increase library fee)
    const { error: updateError } = await supabase
      .from('fee_structure')
      .update({ 
        amount: 4000, 
        base_amount: 4000 
      })
      .eq('class_id', TEST_CLASS_ID)
      .eq('fee_component', 'Library Fee')
      .eq('student_id', null);
    
    if (updateError) {
      console.error('❌ Error updating class fee:', updateError);
      return false;
    }
    
    console.log('   ✅ Class library fee updated from ₹3000 to ₹4000');
    
    // Step 3: Get fees after modification
    const student1After = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_1_ID);
    const student2After = await FeeService.getStudentFeesWithClassBase(TEST_STUDENT_2_ID);
    
    if (!student1After.success || !student2After.success) {
      console.error('❌ Post-update fee fetch failed');
      return false;
    }
    
    // Step 4: Validate both students got the update
    const student1LibraryFee = student1After.data.fees.components.find(c => c.component === 'Library Fee');
    const student2LibraryFee = student2After.data.fees.components.find(c => c.component === 'Library Fee');
    
    console.log(`   Student 1 library fee after update:`);
    console.log(`   - Base amount: ₹${student1LibraryFee.baseFeeAmount}`);
    console.log(`   - Discount: ₹${student1LibraryFee.discountAmount}`);
    console.log(`   - Final amount: ₹${student1LibraryFee.finalAmount}`);
    
    console.log(`   Student 2 library fee after update:`);
    console.log(`   - Base amount: ₹${student2LibraryFee.baseFeeAmount}`);
    console.log(`   - Discount: ₹${student2LibraryFee.discountAmount}`);
    console.log(`   - Final amount: ₹${student2LibraryFee.finalAmount}`);
    
    // Both students should have new base amount
    if (student1LibraryFee.baseFeeAmount !== 4000 || student2LibraryFee.baseFeeAmount !== 4000) {
      console.error('❌ Both students should have updated base fee of ₹4000');
      return false;
    }
    
    // Student 2 should still have discount applied to new amount
    if (student2LibraryFee.discountAmount !== 1000) {
      console.error(`❌ Student 2 should still have ₹1000 discount: ${student2LibraryFee.discountAmount}`);
      return false;
    }
    
    if (student2LibraryFee.finalAmount !== 3000) { // 4000 - 1000
      console.error(`❌ Student 2 final amount should be ₹3000: ${student2LibraryFee.finalAmount}`);
      return false;
    }
    
    console.log('✅ Class fee modification affects all students: PASSED');
    console.log('   - Class fee update reflected for all students');
    console.log('   - Individual discounts still applied to new amounts');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 🧹 Cleanup Test Data
 */
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Delete test discounts
    await supabase
      .from('student_discounts')
      .delete()
      .eq('tenant_id', TEST_TENANT_ID);
    
    // Delete test fees
    await supabase
      .from('fee_structure')
      .delete()
      .eq('tenant_id', TEST_TENANT_ID);
    
    console.log('✅ Test data cleanup complete');
    return true;
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return false;
  }
}

/**
 * 🚀 Run All Tests
 */
export async function runDynamicFeeTests() {
  console.log('🚀 Starting Dynamic Fee Calculation Tests\n');
  console.log('Testing the new architecture where:');
  console.log('- fee_structure contains only class-level fees');
  console.log('- student_discounts contains individual discounts'); 
  console.log('- Fees are calculated dynamically at runtime\n');
  
  const results = {
    setup: false,
    test1: false,
    test2: false,
    test3: false,
    test4: false,
    test5: false,
    cleanup: false
  };
  
  try {
    // Setup
    results.setup = await setupTestData();
    if (!results.setup) {
      console.log('\n❌ Setup failed - stopping tests');
      return results;
    }
    
    // Run tests
    results.test1 = await testClassFeeStructureIntegrity();
    results.test2 = await testDynamicCalculationWithDiscounts();
    results.test3 = await testDynamicCalculationWithoutDiscounts();
    results.test4 = await testDiscountDeletionRestoration();
    results.test5 = await testClassFeeModification();
    
    // Cleanup
    results.cleanup = await cleanupTestData();
    
    // Summary
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('========================');
    console.log(`Setup: ${results.setup ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 1 - Fee Structure Integrity: ${results.test1 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 2 - Dynamic Calculation (With Discounts): ${results.test2 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 3 - Dynamic Calculation (Without General Discounts): ${results.test3 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 4 - Discount Deletion Restoration: ${results.test4 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 5 - Class Fee Modification: ${results.test5 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Cleanup: ${results.cleanup ? '✅ PASSED' : '❌ FAILED'}`);
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! Your dynamic fee calculation system is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the output above for details.');
    }
    
    return results;
    
  } catch (error) {
    console.error('💥 Test suite crashed:', error);
    await cleanupTestData(); // Always try to cleanup
    return results;
  }
}

// For standalone execution
if (typeof require !== 'undefined' && require.main === module) {
  runDynamicFeeTests();
}
