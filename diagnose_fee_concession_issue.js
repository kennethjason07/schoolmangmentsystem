/**
 * Diagnostic Script for Fee Concession Issue
 * 
 * This script helps diagnose and fix issues where applying a fee concession
 * equal to the total fee for a student affects the overall fee structure.
 */

import { supabase, TABLES } from './src/utils/supabase.js';

async function diagnoseFeeConcessionIssue() {
  console.log('🔍 DIAGNOSTIC: Fee Concession Issue');
  console.log('='.repeat(50));
  
  // Test parameters - UPDATE THESE WITH YOUR ACTUAL DATA
  const testParams = {
    studentId: 'your-student-id-here',
    classId: 'your-class-id-here', 
    academicYear: '2024-25',
    discountValue: 500,
    feeComponent: 'Tuition Fee' // or null for all components
  };
  
  console.log('Test Parameters:', testParams);
  console.log('');
  
  try {
    // Step 1: Get BEFORE snapshot of class-level fees
    console.log('📸 STEP 1: Taking BEFORE snapshot of class-level fees');
    const { data: beforeClassFees, error: beforeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, student_id')
      .eq('class_id', testParams.classId)
      .eq('academic_year', testParams.academicYear)
      .is('student_id', null) // Only class-level fees
      .order('fee_component');
    
    if (beforeError) {
      console.error('❌ Error getting before snapshot:', beforeError);
      return;
    }
    
    console.log('📋 BEFORE - Class-level fees (student_id = NULL):');
    beforeClassFees.forEach(fee => {
      console.log(`   ${fee.fee_component}: ₹${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
    });
    console.log('');
    
    // Step 2: Check if student already has concessions
    console.log('📋 STEP 2: Checking existing student concessions');
    const { data: existingDiscounts, error: discountError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('student_id', testParams.studentId)
      .eq('academic_year', testParams.academicYear)
      .eq('is_active', true);
    
    if (discountError) {
      console.error('❌ Error checking existing discounts:', discountError);
      return;
    }
    
    console.log(`📋 Found ${existingDiscounts?.length || 0} existing concessions for student`);
    if (existingDiscounts && existingDiscounts.length > 0) {
      existingDiscounts.forEach(discount => {
        console.log(`   ${discount.fee_component || 'ALL'}: ${discount.discount_type} ${discount.discount_value}`);
      });
    }
    console.log('');
    
    // Step 3: Apply the concession
    console.log('🎯 STEP 3: Applying student concession');
    const { data: discountResult, error: createError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .insert({
        student_id: testParams.studentId,
        class_id: testParams.classId,
        academic_year: testParams.academicYear,
        discount_type: 'fixed_amount',
        discount_value: testParams.discountValue,
        fee_component: testParams.feeComponent,
        description: 'Diagnostic test concession',
        is_active: true
      })
      .select()
      .single();
    
    if (createError) {
      console.error('❌ Error applying concession:', createError);
      return;
    }
    
    console.log('✅ Concession applied successfully');
    console.log('📝 Created discount:', discountResult);
    console.log('');
    
    // Step 4: Get AFTER snapshot of class-level fees
    console.log('📸 STEP 4: Taking AFTER snapshot of class-level fees');
    const { data: afterClassFees, error: afterError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, student_id')
      .eq('class_id', testParams.classId)
      .eq('academic_year', testParams.academicYear)
      .is('student_id', null) // Only class-level fees
      .order('fee_component');
    
    if (afterError) {
      console.error('❌ Error getting after snapshot:', afterError);
      return;
    }
    
    console.log('📋 AFTER - Class-level fees (student_id = NULL):');
    afterClassFees.forEach(fee => {
      console.log(`   ${fee.fee_component}: ₹${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
    });
    console.log('');
    
    // Step 5: Compare before and after
    console.log('⚖️ STEP 5: Comparing before and after');
    let changesFound = false;
    
    for (const afterFee of afterClassFees) {
      const beforeFee = beforeClassFees.find(f => f.id === afterFee.id);
      if (beforeFee && beforeFee.amount !== afterFee.amount) {
        console.log(`   ❌ CHANGE DETECTED: ${afterFee.fee_component} changed from ₹${beforeFee.amount} to ₹${afterFee.amount}`);
        changesFound = true;
      }
    }
    
    if (!changesFound) {
      console.log('   ✅ No changes detected in class-level fees - this is correct behavior');
    }
    console.log('');
    
    // Step 6: Check for student-specific fee entries
    console.log('🔍 STEP 6: Checking for student-specific fee entries');
    const { data: studentFees, error: studentFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, student_id')
      .eq('class_id', testParams.classId)
      .eq('academic_year', testParams.academicYear)
      .eq('student_id', testParams.studentId) // Only student-specific fees
      .order('fee_component');
    
    if (studentFeeError) {
      console.error('❌ Error checking student-specific fees:', studentFeeError);
      return;
    }
    
    console.log(`📋 Found ${studentFees?.length || 0} student-specific fee entries:`);
    if (studentFees && studentFees.length > 0) {
      studentFees.forEach(fee => {
        console.log(`   ${fee.fee_component}: ₹${fee.amount} (ID: ${fee.id})`);
      });
      console.log('   ❌ ISSUE: Student-specific fee entries should not be created');
    } else {
      console.log('   ✅ No student-specific fee entries found - this is correct behavior');
    }
    console.log('');
    
    // Step 7: Calculate student fees with discount
    console.log('🧮 STEP 7: Calculating student fees with discount');
    // Import the fee calculation function
    const { calculateStudentFees } = await import('./src/utils/feeCalculation.js');
    
    const feeCalculation = await calculateStudentFees(
      testParams.studentId,
      testParams.classId
    );
    
    if (feeCalculation.error) {
      console.error('❌ Error calculating fees:', feeCalculation.error);
      return;
    }
    
    console.log('📊 Fee calculation results:');
    console.log(`   Total Base Fee: ₹${feeCalculation.totalBaseFee}`);
    console.log(`   Total Discounts: ₹${feeCalculation.totalDiscounts}`);
    console.log(`   Total Due: ₹${feeCalculation.totalAmount}`);
    console.log(`   Total Paid: ₹${feeCalculation.totalPaid}`);
    console.log(`   Outstanding: ₹${feeCalculation.totalOutstanding}`);
    
    feeCalculation.details.forEach(detail => {
      console.log(`   ${detail.feeComponent}: ₹${detail.baseFeeAmount} - ₹${detail.totalDiscountAmount} = ₹${detail.finalAmount}`);
    });
    console.log('');
    
    // Step 8: Clean up test discount
    console.log('🧹 STEP 8: Cleaning up test discount');
    const { error: deleteError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .delete()
      .eq('id', discountResult.id);
    
    if (deleteError) {
      console.error('❌ Error cleaning up test discount:', deleteError);
    } else {
      console.log('✅ Test discount cleaned up successfully');
    }
    console.log('');
    
    // Final diagnosis
    console.log('🏁 FINAL DIAGNOSIS:');
    console.log('='.repeat(50));
    
    if (changesFound) {
      console.log('❌ ISSUE CONFIRMED: Class-level fees were modified when applying student concession');
      console.log('   This indicates a bug in the fee concession implementation.');
      console.log('   The system should only store concessions in the student_discounts table');
      console.log('   and calculate fees dynamically without modifying fee_structure.');
    } else if (studentFees && studentFees.length > 0) {
      console.log('❌ ISSUE DETECTED: Student-specific fee entries were created');
      console.log('   This indicates a bug in the fee concession implementation.');
      console.log('   The system should only store concessions in the student_discounts table');
      console.log('   and calculate fees dynamically without creating student-specific entries.');
    } else {
      console.log('✅ NO ISSUES DETECTED: Fee concession system working correctly');
      console.log('   - Class-level fees remain unchanged');
      console.log('   - No student-specific fee entries created');
      console.log('   - Concessions stored only in student_discounts table');
      console.log('   - Fees calculated dynamically with discounts applied');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Instructions for running
console.log(`
📝 TO RUN THIS DIAGNOSTIC:

1. Update testParams with your actual IDs:
   - studentId: Use an actual student ID
   - classId: Use an actual class ID
   
2. Run: node diagnose_fee_concession_issue.js

3. This will show you:
   - Current fee structure (class vs student-specific)
   - What happens when applying a new discount
   - Whether class fees are being modified
   - Whether student-specific entries are being created
   - How fees are calculated with discounts

This will help identify exactly what's going wrong with the concession system.
`);

// Export for use
export { diagnoseFeeConcessionIssue };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseFeeConcessionIssue();
}