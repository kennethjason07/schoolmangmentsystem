// TEST SCRIPT: Individual Student Fee Concession System
// This script tests the complete flow to ensure individual concessions work correctly

import { supabase, dbHelpers, TABLES } from './src/utils/supabase.js';
import { calculateStudentFees } from './src/utils/feeCalculation.js';

async function testIndividualFeeConcessionSystem() {
  console.log('🧪 TESTING: Individual Student Fee Concession System');
  console.log('=' .repeat(80));

  try {
    // Test configuration - UPDATE THESE WITH YOUR ACTUAL IDS
    const testConfig = {
      classId: 'your-class-id-here',        // Replace with actual class ID
      academicYear: '2024-25',
      studentId1: 'student-1-id-here',      // Replace with first student ID
      studentId2: 'student-2-id-here',      // Replace with second student ID
      feeComponent: 'Tuition Fee',
      baseFeeAmount: 5000,
      discountAmount: 500
    };

    console.log('📋 Test Configuration:', testConfig);
    console.log('');

    // STEP 1: Clean up any existing data
    console.log('🧹 STEP 1: Cleaning up existing test data');
    
    // Remove any existing fee structures for this class/component
    await supabase
      .from(TABLES.FEE_STRUCTURE)
      .delete()
      .eq('class_id', testConfig.classId)
      .eq('fee_component', testConfig.feeComponent)
      .eq('academic_year', testConfig.academicYear);

    // Remove any existing student discounts
    await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .delete()
      .eq('class_id', testConfig.classId)
      .eq('fee_component', testConfig.feeComponent)
      .eq('academic_year', testConfig.academicYear);

    console.log('✅ Cleanup completed');
    console.log('');

    // STEP 2: Create class-level fee structure
    console.log('🏗️ STEP 2: Creating class-level fee structure');
    
    const { data: classFeeResult, error: classFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .insert({
        class_id: testConfig.classId,
        student_id: null, // ⚠️ CRITICAL: Class-level fee (null student_id)
        fee_component: testConfig.feeComponent,
        amount: testConfig.baseFeeAmount,
        base_amount: testConfig.baseFeeAmount,
        discount_applied: 0,
        academic_year: testConfig.academicYear,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tenant_id: 'your-tenant-id-here' // Replace with actual tenant ID
      })
      .select()
      .single();

    if (classFeeError) throw classFeeError;

    console.log('✅ Class-level fee created:', {
      id: classFeeResult.id,
      student_id: classFeeResult.student_id,
      amount: classFeeResult.amount
    });
    console.log('');

    // STEP 3: Verify initial state - both students should see same fees
    console.log('🔍 STEP 3: Verifying initial state (both students see class fees)');
    
    const student1InitialFees = await calculateStudentFees(testConfig.studentId1, testConfig.classId);
    const student2InitialFees = await calculateStudentFees(testConfig.studentId2, testConfig.classId);
    
    console.log(`Student 1 initial fees: ₹${student1InitialFees.totalAmount}`);
    console.log(`Student 2 initial fees: ₹${student2InitialFees.totalAmount}`);
    
    if (student1InitialFees.totalAmount !== student2InitialFees.totalAmount) {
      throw new Error('❌ FAIL: Students should have same initial fees');
    }
    console.log('✅ Both students see the same class fees initially');
    console.log('');

    // STEP 4: Apply discount to Student 1 only
    console.log('🎯 STEP 4: Applying discount to Student 1 only');
    
    const { data: discountResult, error: discountError } = await dbHelpers.createStudentDiscount({
      student_id: testConfig.studentId1,
      class_id: testConfig.classId,
      academic_year: testConfig.academicYear,
      discount_type: 'fixed_amount',
      discount_value: testConfig.discountAmount,
      fee_component: testConfig.feeComponent,
      description: 'Test discount for individual student'
    });
    
    if (discountError) throw discountError;
    console.log('✅ Discount created for Student 1');
    console.log('');

    // STEP 5: Verify class-level fees are unchanged
    console.log('🔒 STEP 5: Verifying class-level fees remain unchanged');
    
    const { data: unchangedClassFees, error: unchangedError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('class_id', testConfig.classId)
      .eq('fee_component', testConfig.feeComponent)
      .is('student_id', null); // Only class-level fees
    
    if (unchangedError) throw unchangedError;
    
    const originalClassFee = unchangedClassFees[0];
    if (originalClassFee.amount !== testConfig.baseFeeAmount) {
      throw new Error(`❌ FAIL: Class fee amount changed! Expected ${testConfig.baseFeeAmount}, got ${originalClassFee.amount}`);
    }
    
    console.log('✅ Class-level fees remain unchanged:', {
      id: originalClassFee.id,
      amount: originalClassFee.amount,
      student_id: originalClassFee.student_id
    });
    console.log('');

    // STEP 6: Verify student-specific fee entry was created
    console.log('👤 STEP 6: Verifying student-specific fee entry was created');
    
    const { data: studentSpecificFees, error: studentFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('student_id', testConfig.studentId1)
      .eq('class_id', testConfig.classId)
      .eq('fee_component', testConfig.feeComponent);
    
    if (studentFeeError) throw studentFeeError;
    
    if (!studentSpecificFees || studentSpecificFees.length === 0) {
      throw new Error('❌ FAIL: No student-specific fee entry created');
    }
    
    const studentFee = studentSpecificFees[0];
    const expectedStudentAmount = testConfig.baseFeeAmount - testConfig.discountAmount;
    
    if (studentFee.amount !== expectedStudentAmount) {
      throw new Error(`❌ FAIL: Student fee amount incorrect! Expected ${expectedStudentAmount}, got ${studentFee.amount}`);
    }
    
    console.log('✅ Student-specific fee entry created correctly:', {
      id: studentFee.id,
      student_id: studentFee.student_id,
      amount: studentFee.amount,
      base_amount: studentFee.base_amount,
      discount_applied: studentFee.discount_applied
    });
    console.log('');

    // STEP 7: Test fee calculations after discount
    console.log('💰 STEP 7: Testing fee calculations after discount');
    
    const student1PostDiscountFees = await calculateStudentFees(testConfig.studentId1, testConfig.classId);
    const student2PostDiscountFees = await calculateStudentFees(testConfig.studentId2, testConfig.classId);
    
    console.log(`Student 1 fees after discount: ₹${student1PostDiscountFees.totalAmount}`);
    console.log(`Student 2 fees (unchanged): ₹${student2PostDiscountFees.totalAmount}`);
    
    // Verify Student 1 has reduced fees
    if (student1PostDiscountFees.totalAmount !== expectedStudentAmount) {
      throw new Error(`❌ FAIL: Student 1 fee calculation incorrect! Expected ${expectedStudentAmount}, got ${student1PostDiscountFees.totalAmount}`);
    }
    
    // Verify Student 2 still has original fees
    if (student2PostDiscountFees.totalAmount !== testConfig.baseFeeAmount) {
      throw new Error(`❌ FAIL: Student 2 fees changed! Expected ${testConfig.baseFeeAmount}, got ${student2PostDiscountFees.totalAmount}`);
    }
    
    console.log('✅ Fee calculations correct:');
    console.log(`   Student 1: ₹${testConfig.baseFeeAmount} - ₹${testConfig.discountAmount} = ₹${expectedStudentAmount}`);
    console.log(`   Student 2: ₹${testConfig.baseFeeAmount} (unchanged)`);
    console.log('');

    // STEP 8: Verify fee calculation details
    console.log('🔍 STEP 8: Verifying detailed fee calculation logic');
    
    // Check that Student 1's calculation shows the discount
    const student1Detail = student1PostDiscountFees.details.find(d => d.feeComponent === testConfig.feeComponent);
    if (!student1Detail) {
      throw new Error('❌ FAIL: Student 1 fee component not found in details');
    }
    
    if (student1Detail.isIndividualFee !== true) {
      throw new Error('❌ FAIL: Student 1 fee should be marked as individual fee');
    }
    
    // Check that Student 2's calculation uses class fee
    const student2Detail = student2PostDiscountFees.details.find(d => d.feeComponent === testConfig.feeComponent);
    if (!student2Detail) {
      throw new Error('❌ FAIL: Student 2 fee component not found in details');
    }
    
    if (student2Detail.isClassFee !== true) {
      throw new Error('❌ FAIL: Student 2 fee should be marked as class fee');
    }
    
    console.log('✅ Fee calculation details verified:');
    console.log(`   Student 1: Individual fee = ₹${student1Detail.finalAmount} (discount: ₹${student1Detail.discountAmount || 0})`);
    console.log(`   Student 2: Class fee = ₹${student2Detail.finalAmount} (no discount)`);
    console.log('');

    // STEP 9: Final verification - count database entries
    console.log('📊 STEP 9: Final database verification');
    
    // Should have exactly 1 class-level fee and 1 student-specific fee
    const { data: allFeeEntries, error: allFeesError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('class_id', testConfig.classId)
      .eq('fee_component', testConfig.feeComponent)
      .eq('academic_year', testConfig.academicYear);
    
    if (allFeesError) throw allFeesError;
    
    const classLevelFees = allFeeEntries.filter(f => f.student_id === null);
    const studentSpecificFees = allFeeEntries.filter(f => f.student_id !== null);
    
    console.log(`Total fee entries: ${allFeeEntries.length}`);
    console.log(`Class-level fees: ${classLevelFees.length}`);
    console.log(`Student-specific fees: ${studentSpecificFees.length}`);
    
    if (classLevelFees.length !== 1) {
      throw new Error(`❌ FAIL: Expected 1 class-level fee, got ${classLevelFees.length}`);
    }
    
    if (studentSpecificFees.length !== 1) {
      throw new Error(`❌ FAIL: Expected 1 student-specific fee, got ${studentSpecificFees.length}`);
    }
    
    console.log('✅ Database structure is correct');
    console.log('');

    // SUCCESS!
    console.log('🎉 SUCCESS: All tests passed!');
    console.log('=' .repeat(80));
    console.log('✅ Individual Student Fee Concession System working correctly:');
    console.log('   ✓ Class-level fees remain unchanged when adding concessions');
    console.log('   ✓ Student-specific fee entries are created for individual concessions');
    console.log('   ✓ Fee calculation prioritizes student-specific fees over class fees');
    console.log('   ✓ Other students are unaffected by individual concessions');
    console.log('   ✓ Database structure maintains proper separation of concerns');

  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Helper function to run with error handling
async function runTest() {
  try {
    await testIndividualFeeConcessionSystem();
    console.log('\n🏁 Test completed successfully!');
  } catch (error) {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  }
}

// Export for use or run directly
export { testIndividualFeeConcessionSystem };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest();
}

// Instructions for running the test:
console.log(`
📝 TO RUN THIS TEST:

1. Update the test configuration at the top of the script:
   - classId: Use an actual class ID from your database
   - studentId1, studentId2: Use actual student IDs from that class
   - tenant_id: Use your actual tenant ID

2. Run the test:
   node test_individual_fee_concession.js

3. The test will:
   - Create a class-level fee structure
   - Apply a concession to only one student
   - Verify that:
     * Class fees remain unchanged for other students
     * Individual student gets a separate fee entry with discount
     * Fee calculations work correctly for both scenarios

4. After testing, you can clean up by removing the test data or let the script handle cleanup on the next run.
`);
