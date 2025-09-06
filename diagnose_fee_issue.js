// DIAGNOSTIC SCRIPT: Fee Concession System Issue Analysis
// This will help identify the specific problem with fee concession calculations

import { supabase, dbHelpers, TABLES } from './src/utils/supabase.js';
import { calculateStudentFees } from './src/utils/feeCalculation.js';

async function diagnoseFeeConcessionIssue() {
  console.log('🔍 DIAGNOSING: Fee Concession System Issue');
  console.log('=' .repeat(60));

  try {
    // Configuration - you'll need to update these
    const testConfig = {
      classId: 'your-class-id-here',        // Replace with actual class ID
      studentId: 'student-id-here',         // Replace with actual student ID
      academicYear: '2024-25',
      feeComponent: 'Tuition Fee',
      baseFeeAmount: 5000,
      discountAmount: 500
    };

    console.log('📋 Configuration:', testConfig);
    console.log('');

    // STEP 1: Check current fee structure for the class
    console.log('🏗️ STEP 1: Current class-level fee structure');
    
    const { data: classFees, error: classFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('class_id', testConfig.classId)
      .eq('academic_year', testConfig.academicYear)
      .is('student_id', null); // Class-level fees only
    
    if (classFeeError) {
      console.error('❌ Error fetching class fees:', classFeeError);
      return;
    }
    
    console.log(`Found ${classFees?.length || 0} class-level fee entries:`);
    classFees?.forEach(fee => {
      console.log(`  📝 ${fee.fee_component}: ₹${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
      console.log(`      base_amount: ${fee.base_amount}, discount_applied: ${fee.discount_applied}`);
    });
    console.log('');

    // STEP 2: Check student-specific fees (if any)
    console.log('👤 STEP 2: Current student-specific fee structure');
    
    const { data: studentFees, error: studentFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('*')
      .eq('student_id', testConfig.studentId)
      .eq('class_id', testConfig.classId)
      .eq('academic_year', testConfig.academicYear);
    
    if (studentFeeError) {
      console.error('❌ Error fetching student fees:', studentFeeError);
      return;
    }
    
    console.log(`Found ${studentFees?.length || 0} student-specific fee entries:`);
    studentFees?.forEach(fee => {
      console.log(`  📝 ${fee.fee_component}: ₹${fee.amount} (ID: ${fee.id}, student_id: ${fee.student_id})`);
      console.log(`      base_amount: ${fee.base_amount}, discount_applied: ${fee.discount_applied}`);
    });
    console.log('');

    // STEP 3: Check active discounts for the student
    console.log('🎯 STEP 3: Current student discounts');
    
    const { data: discounts, error: discountError } = await supabase
      .from(TABLES.STUDENT_DISCOUNTS)
      .select('*')
      .eq('student_id', testConfig.studentId)
      .eq('is_active', true);
    
    if (discountError) {
      console.error('❌ Error fetching discounts:', discountError);
      return;
    }
    
    console.log(`Found ${discounts?.length || 0} active discount entries:`);
    discounts?.forEach(discount => {
      console.log(`  🎯 ${discount.fee_component}: -₹${discount.discount_value} (${discount.discount_type})`);
      console.log(`      Description: ${discount.description}`);
      console.log(`      Academic Year: ${discount.academic_year}`);
    });
    console.log('');

    // STEP 4: Test fee calculation for this student
    console.log('💰 STEP 4: Current fee calculation result');
    
    const feeCalculation = await calculateStudentFees(testConfig.studentId, testConfig.classId);
    
    console.log(`Total Fee: ₹${feeCalculation.totalAmount}`);
    console.log(`Total Paid: ₹${feeCalculation.totalPaid}`);
    console.log(`Outstanding: ₹${feeCalculation.totalOutstanding}`);
    console.log('');
    console.log('Fee Details:');
    feeCalculation.details?.forEach(detail => {
      console.log(`  📊 ${detail.feeComponent}:`);
      console.log(`      Base: ₹${detail.baseFeeAmount}`);
      console.log(`      Discount: ₹${detail.discountAmount}`);
      console.log(`      Final: ₹${detail.finalAmount}`);
      console.log(`      Paid: ₹${detail.paidAmount}`);
      console.log(`      Remaining: ₹${detail.remainingAmount}`);
      console.log(`      Status: ${detail.status}`);
    });
    console.log('');

    // STEP 5: Simulate applying a new discount
    console.log('🔬 STEP 5: Simulating new discount application');
    console.log(`Applying discount of ₹${testConfig.discountAmount} to ${testConfig.feeComponent}`);
    
    // Check what the applyStudentDiscountToFeeStructure function would do
    const targetClassFee = classFees?.find(fee => fee.fee_component === testConfig.feeComponent);
    if (targetClassFee) {
      console.log(`Class fee found: ₹${targetClassFee.amount} for ${targetClassFee.fee_component}`);
      
      const expectedStudentAmount = targetClassFee.amount - testConfig.discountAmount;
      console.log(`Expected student-specific amount: ₹${targetClassFee.amount} - ₹${testConfig.discountAmount} = ₹${expectedStudentAmount}`);
      
      // Check if student-specific entry already exists
      const existingStudentFee = studentFees?.find(fee => fee.fee_component === testConfig.feeComponent);
      if (existingStudentFee) {
        console.log('⚠️ Student-specific fee already exists:');
        console.log(`    Current amount: ₹${existingStudentFee.amount}`);
        console.log(`    Current discount_applied: ₹${existingStudentFee.discount_applied}`);
        console.log('    This means a new discount would need to update this entry, not create a new one');
      } else {
        console.log('✅ No existing student-specific fee - new entry would be created');
      }
    } else {
      console.log(`❌ No class fee found for component: ${testConfig.feeComponent}`);
    }
    console.log('');

    // STEP 6: Analysis and recommendations
    console.log('🎯 STEP 6: ANALYSIS & RECOMMENDATIONS');
    console.log('=' .repeat(40));
    
    // Check for common issues
    const issues = [];
    
    if (!classFees || classFees.length === 0) {
      issues.push('❌ No class-level fee structure found. Create class fees first.');
    }
    
    if (classFees?.some(fee => fee.student_id !== null)) {
      issues.push('⚠️ Some class-level fees have non-null student_id. This is incorrect.');
    }
    
    if (studentFees?.some(fee => 
      fee.base_amount !== classFees?.find(cf => cf.fee_component === fee.fee_component)?.amount
    )) {
      issues.push('⚠️ Student fee base_amount doesn\'t match class fee amount. Check calculation logic.');
    }
    
    const duplicateStudentFees = new Set();
    const studentFeeComponents = studentFees?.map(fee => fee.fee_component) || [];
    for (const component of studentFeeComponents) {
      if (studentFeeComponents.filter(c => c === component).length > 1) {
        duplicateStudentFees.add(component);
      }
    }
    if (duplicateStudentFees.size > 0) {
      issues.push(`⚠️ Duplicate student-specific fees found for: ${Array.from(duplicateStudentFees).join(', ')}`);
    }
    
    if (issues.length > 0) {
      console.log('ISSUES FOUND:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✅ No obvious structural issues found');
    }
    
    console.log('');
    console.log('EXPECTED BEHAVIOR:');
    console.log('  1. Class fees should have student_id = null');
    console.log('  2. When applying concession, create new row with student_id = studentId');
    console.log('  3. Student-specific fee amount = class_fee_amount - discount_amount');
    console.log('  4. Fee calculation should prioritize student-specific over class fees');
    console.log('  5. Other students should still see original class fees');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Instructions for running
console.log(`
📝 TO RUN THIS DIAGNOSTIC:

1. Update testConfig with your actual IDs:
   - classId: Use an actual class ID
   - studentId: Use an actual student ID
   
2. Run: node diagnose_fee_issue.js

3. This will show you:
   - Current fee structure (class vs student-specific)
   - Active discounts
   - Fee calculation results
   - What would happen when applying a new discount
   - Any structural issues with your data

This will help identify exactly what's going wrong with the concession system.
`);

// Export for use
export { diagnoseFeeConcessionIssue };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  diagnoseFeeConcessionIssue();
}
