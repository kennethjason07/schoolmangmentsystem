// DEBUG SCRIPT: Test fee concession behavior
// Run this to verify that class fees are not being modified

import { dbHelpers } from './src/utils/supabase.js';

async function debugFeeConcession() {
  console.log('🔍 DEBUGGING: Fee Concession Behavior');
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
      .from('fee_structure')
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
      console.log(`   ${fee.fee_component}: ${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
    });
    console.log('');
    
    // Step 2: Apply the concession
    console.log('🎯 STEP 2: Applying student concession');
    const result = await dbHelpers.applyStudentDiscountToFeeStructure(
      testParams.studentId,
      testParams.classId,
      testParams.academicYear,
      testParams.discountValue,
      testParams.feeComponent
    );
    
    if (result.error) {
      console.error('❌ Error applying concession:', result.error);
      return;
    }
    
    console.log('✅ Concession applied successfully');
    console.log('📝 Created student-specific entries:', result.data?.length || 0);
    console.log('');
    
    // Step 3: Get AFTER snapshot of class-level fees
    console.log('📸 STEP 3: Taking AFTER snapshot of class-level fees');
    const { data: afterClassFees, error: afterError } = await supabase
      .from('fee_structure')
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
      console.log(`   ${fee.fee_component}: ${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
    });
    console.log('');
    
    // Step 4: Compare BEFORE and AFTER
    console.log('🔍 STEP 4: Comparing BEFORE and AFTER');
    let changesDetected = false;
    
    for (const beforeFee of beforeClassFees) {
      const afterFee = afterClassFees.find(f => f.id === beforeFee.id);
      
      if (!afterFee) {
        console.log(`❌ PROBLEM: Class fee deleted - ${beforeFee.fee_component} (ID: ${beforeFee.id})`);
        changesDetected = true;
      } else if (beforeFee.amount !== afterFee.amount) {
        console.log(`❌ PROBLEM: Class fee amount changed - ${beforeFee.fee_component}`);
        console.log(`   BEFORE: ${beforeFee.amount} → AFTER: ${afterFee.amount} (ID: ${beforeFee.id})`);
        changesDetected = true;
      } else if (beforeFee.student_id !== afterFee.student_id) {
        console.log(`❌ PROBLEM: Class fee student_id changed - ${beforeFee.fee_component}`);
        console.log(`   BEFORE: ${beforeFee.student_id} → AFTER: ${afterFee.student_id} (ID: ${beforeFee.id})`);
        changesDetected = true;
      }
    }
    
    if (!changesDetected) {
      console.log('✅ SUCCESS: No changes detected in class-level fees!');
    } else {
      console.log('❌ PROBLEM: Changes detected in class-level fees - this should NOT happen!');
    }
    console.log('');
    
    // Step 5: Show student-specific fees created
    console.log('📝 STEP 5: Showing student-specific fees created');
    const { data: studentFees, error: studentError } = await supabase
      .from('fee_structure')
      .select('id, fee_component, amount, base_amount, discount_applied, student_id')
      .eq('student_id', testParams.studentId)
      .eq('class_id', testParams.classId)
      .eq('academic_year', testParams.academicYear)
      .order('fee_component');
    
    if (studentError) {
      console.error('❌ Error getting student fees:', studentError);
    } else {
      console.log('📋 Student-specific fees (student_id =', testParams.studentId + '):');
      if (studentFees && studentFees.length > 0) {
        studentFees.forEach(fee => {
          console.log(`   ${fee.fee_component}: ${fee.amount} (was ${fee.base_amount}, discount: ${fee.discount_applied})`);
        });
      } else {
        console.log('   (No student-specific fees found)');
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error during debug:', error);
  }
  
  console.log('');
  console.log('🎯 DEBUG COMPLETE');
  console.log('='.repeat(50));
}

// Export for use
export { debugFeeConcession };

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugFeeConcession();
}
