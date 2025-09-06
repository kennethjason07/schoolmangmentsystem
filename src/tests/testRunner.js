/**
 * 🧪 MANUAL TEST RUNNER FOR DYNAMIC FEE CALCULATION
 * 
 * This script provides simple functions you can call to test your new
 * dynamic fee calculation system manually.
 */

import { supabase } from '../utils/supabase';
import FeeService from '../services/FeeService';

/**
 * 🎯 Quick Test: Test with Real Data
 * Use this to test with your actual school data
 */
export async function quickTest() {
  console.log('🚀 Quick Test: Testing Dynamic Fee Calculation with Real Data\n');
  
  try {
    // Step 1: Find a real class in your system
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select('id, class_name, section')
      .limit(5);
    
    if (classError || !classes || classes.length === 0) {
      console.log('❌ No classes found. Please add some classes first.');
      return false;
    }
    
    console.log('📋 Available classes:');
    classes.forEach((cls, index) => {
      console.log(`   ${index + 1}. ${cls.class_name} ${cls.section || ''} (ID: ${cls.id})`);
    });
    
    const testClass = classes[0];
    console.log(`\n🎯 Testing with class: ${testClass.class_name} ${testClass.section || ''}`);
    
    // Step 2: Check existing fee structure for this class
    const { data: classFees, error: feeError } = await supabase
      .from('fee_structure')
      .select('*')
      .eq('class_id', testClass.id)
      .eq('academic_year', '2024-2025');
    
    if (feeError) {
      console.log('❌ Error fetching fee structure:', feeError.message);
      return false;
    }
    
    console.log(`\n💰 Fee Structure Analysis:`);
    console.log(`   Found ${classFees?.length || 0} fee components`);
    
    if (!classFees || classFees.length === 0) {
      console.log('   ⚠️ No fees found for this class. Please add some class fees first.');
      console.log('   You can add fees using the Admin panel or createClassFee function.');
      return false;
    }
    
    // Analyze fee structure integrity
    let hasStudentSpecificFees = false;
    let hasInconsistentBaseFees = false;
    
    classFees.forEach(fee => {
      console.log(`   📝 ${fee.fee_component}: ₹${fee.amount}`);
      console.log(`      - student_id: ${fee.student_id || 'null (✅ class-level)'}`);
      console.log(`      - base_amount: ₹${fee.base_amount}, amount: ₹${fee.amount}`);
      
      if (fee.student_id !== null) {
        hasStudentSpecificFees = true;
      }
      
      if (fee.base_amount !== fee.amount) {
        hasInconsistentBaseFees = true;
      }
    });
    
    // Report fee structure health
    console.log(`\n🔍 Fee Structure Health Check:`);
    console.log(`   ✅ Class-level fees only: ${!hasStudentSpecificFees ? 'YES' : 'NO ❌'}`);
    console.log(`   ✅ base_amount = amount: ${!hasInconsistentBaseFees ? 'YES' : 'NO ❌'}`);
    
    if (hasStudentSpecificFees || hasInconsistentBaseFees) {
      console.log('   ⚠️ Fee structure needs cleanup. Please run cleanupFeeStructure() to fix.');
      return false;
    }
    
    // Step 3: Find students in this class
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, name, admission_no')
      .eq('class_id', testClass.id)
      .limit(3);
    
    if (studentError || !students || students.length === 0) {
      console.log('❌ No students found in this class.');
      return false;
    }
    
    console.log(`\n👥 Testing with students:`);
    students.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.name} (${student.admission_no})`);
    });
    
    // Step 4: Test dynamic calculation for each student
    for (const student of students) {
      console.log(`\n🧮 Testing dynamic calculation for ${student.name}:`);
      
      const result = await FeeService.getStudentFeesWithClassBase(student.id);
      
      if (!result.success) {
        console.log(`   ❌ Calculation failed: ${result.error}`);
        continue;
      }
      
      const { fees } = result.data;
      console.log(`   💰 Fee Summary:`);
      console.log(`      - Class Base Fee: ₹${fees.classBaseFee}`);
      console.log(`      - Individual Discounts: ₹${fees.individualDiscounts}`);
      console.log(`      - Total Due: ₹${fees.totalDue}`);
      console.log(`      - Total Paid: ₹${fees.totalPaid}`);
      console.log(`      - Outstanding: ₹${fees.totalOutstanding}`);
      
      console.log(`   📋 Fee Components:`);
      fees.components.forEach(component => {
        const discountText = component.discountAmount > 0 ? 
          ` (₹${component.discountAmount} discount)` : '';
        console.log(`      - ${component.name}: ₹${component.baseFeeAmount} → ₹${component.finalAmount}${discountText}`);
      });
    }
    
    console.log('\n✅ Quick test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}

/**
 * 🧹 Cleanup Fee Structure
 * Removes any student-specific fees and ensures base_amount = amount
 */
export async function cleanupFeeStructure() {
  console.log('🧹 Cleaning up fee structure...\n');
  
  try {
    // Step 1: Find and remove student-specific fees
    const { data: studentFees, error: fetchError } = await supabase
      .from('fee_structure')
      .select('id, fee_component, student_id, class_id')
      .not('student_id', 'is', null);
    
    if (fetchError) {
      console.log('❌ Error fetching student-specific fees:', fetchError.message);
      return false;
    }
    
    if (studentFees && studentFees.length > 0) {
      console.log(`🗑️ Found ${studentFees.length} student-specific fee entries to remove:`);
      studentFees.forEach(fee => {
        console.log(`   - ${fee.fee_component} for student ${fee.student_id}`);
      });
      
      const { error: deleteError } = await supabase
        .from('fee_structure')
        .delete()
        .not('student_id', 'is', null);
      
      if (deleteError) {
        console.log('❌ Error deleting student-specific fees:', deleteError.message);
        return false;
      }
      
      console.log('✅ Student-specific fees removed');
    } else {
      console.log('✅ No student-specific fees found');
    }
    
    // Step 2: Fix base_amount to equal amount for all class fees
    const { data: classFees, error: classFeesError } = await supabase
      .from('fee_structure')
      .select('id, fee_component, amount, base_amount')
      .is('student_id', null)
      .neq('base_amount', 'amount');
    
    if (classFeesError) {
      console.log('❌ Error fetching class fees:', classFeesError.message);
      return false;
    }
    
    if (classFees && classFees.length > 0) {
      console.log(`\n🔧 Found ${classFees.length} class fees with incorrect base_amount:`);
      classFees.forEach(fee => {
        console.log(`   - ${fee.fee_component}: base_amount=₹${fee.base_amount}, amount=₹${fee.amount}`);
      });
      
      for (const fee of classFees) {
        const { error: updateError } = await supabase
          .from('fee_structure')
          .update({ base_amount: fee.amount })
          .eq('id', fee.id);
        
        if (updateError) {
          console.log(`❌ Error updating ${fee.fee_component}:`, updateError.message);
        } else {
          console.log(`✅ Fixed ${fee.fee_component}: base_amount set to ₹${fee.amount}`);
        }
      }
    } else {
      console.log('✅ All class fees have correct base_amount = amount');
    }
    
    console.log('\n🎉 Fee structure cleanup completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return false;
  }
}

/**
 * 🎁 Test Discount Creation and Deletion
 */
export async function testDiscountFlow(studentId, feeComponent = 'Tuition Fee', discountType = 'percentage', discountValue = 10) {
  console.log(`🧪 Testing discount flow for student ${studentId}\n`);
  
  try {
    // Step 1: Get fees before discount
    console.log('📊 Getting fees before discount...');
    let result = await FeeService.getStudentFeesWithClassBase(studentId);
    
    if (!result.success) {
      console.log('❌ Failed to get initial fees:', result.error);
      return false;
    }
    
    const beforeFee = result.data.fees.components.find(c => c.component === feeComponent);
    if (!beforeFee) {
      console.log(`❌ Fee component "${feeComponent}" not found`);
      return false;
    }
    
    console.log(`   Before: ₹${beforeFee.baseFeeAmount} → ₹${beforeFee.finalAmount} (discount: ₹${beforeFee.discountAmount})`);
    
    // Step 2: Create discount
    console.log(`\n🎁 Creating ${discountValue}${discountType === 'percentage' ? '%' : '₹'} discount on ${feeComponent}...`);
    
    const discountId = `test-discount-${Date.now()}`;
    const { error: createError } = await supabase
      .from('student_discounts')
      .insert([{
        id: discountId,
        student_id: studentId,
        fee_component: feeComponent,
        discount_type: discountType,
        discount_value: discountValue,
        reason: 'Test discount',
        academic_year: '2024-2025',
        is_active: true
      }]);
    
    if (createError) {
      console.log('❌ Error creating discount:', createError.message);
      return false;
    }
    
    // Step 3: Get fees after discount
    console.log('📊 Getting fees after discount...');
    result = await FeeService.getStudentFeesWithClassBase(studentId);
    
    if (!result.success) {
      console.log('❌ Failed to get fees after discount:', result.error);
      return false;
    }
    
    const afterFee = result.data.fees.components.find(c => c.component === feeComponent);
    console.log(`   After:  ₹${afterFee.baseFeeAmount} → ₹${afterFee.finalAmount} (discount: ₹${afterFee.discountAmount})`);
    
    // Step 4: Verify discount calculation
    let expectedDiscount;
    if (discountType === 'percentage') {
      expectedDiscount = (beforeFee.baseFeeAmount * discountValue) / 100;
    } else {
      expectedDiscount = discountValue;
    }
    
    const calculationCorrect = Math.abs(afterFee.discountAmount - expectedDiscount) < 0.01;
    console.log(`   Expected discount: ₹${expectedDiscount}`);
    console.log(`   Actual discount: ₹${afterFee.discountAmount}`);
    console.log(`   Calculation correct: ${calculationCorrect ? '✅' : '❌'}`);
    
    // Step 5: Delete discount
    console.log('\n🗑️ Deleting discount...');
    const { error: deleteError } = await supabase
      .from('student_discounts')
      .delete()
      .eq('id', discountId);
    
    if (deleteError) {
      console.log('❌ Error deleting discount:', deleteError.message);
      return false;
    }
    
    // Step 6: Get fees after deletion
    console.log('📊 Getting fees after deletion...');
    result = await FeeService.getStudentFeesWithClassBase(studentId);
    
    if (!result.success) {
      console.log('❌ Failed to get fees after deletion:', result.error);
      return false;
    }
    
    const restoredFee = result.data.fees.components.find(c => c.component === feeComponent);
    console.log(`   Restored: ₹${restoredFee.baseFeeAmount} → ₹${restoredFee.finalAmount} (discount: ₹${restoredFee.discountAmount})`);
    
    // Step 7: Verify restoration
    const restoredCorrectly = restoredFee.discountAmount === 0 && restoredFee.finalAmount === restoredFee.baseFeeAmount;
    console.log(`   Restored correctly: ${restoredCorrectly ? '✅' : '❌'}`);
    
    if (calculationCorrect && restoredCorrectly) {
      console.log('\n🎉 Discount flow test PASSED!');
      return true;
    } else {
      console.log('\n❌ Discount flow test FAILED!');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

/**
 * 📝 Show System Status
 */
export async function showSystemStatus() {
  console.log('📊 DYNAMIC FEE SYSTEM STATUS\n');
  
  try {
    // Check fee structure health
    const { data: allFees, error: feeError } = await supabase
      .from('fee_structure')
      .select('id, student_id, amount, base_amount, fee_component')
      .eq('academic_year', '2024-2025');
    
    if (feeError) {
      console.log('❌ Error fetching fees:', feeError.message);
      return;
    }
    
    const classFees = allFees?.filter(f => f.student_id === null) || [];
    const studentFees = allFees?.filter(f => f.student_id !== null) || [];
    const inconsistentFees = classFees.filter(f => f.amount !== f.base_amount);
    
    console.log('🏫 Fee Structure Status:');
    console.log(`   📋 Total class-level fees: ${classFees.length}`);
    console.log(`   🚨 Student-specific fees (should be 0): ${studentFees.length}`);
    console.log(`   ⚠️ Inconsistent base_amount (should be 0): ${inconsistentFees.length}`);
    
    // Check discounts
    const { data: discounts, error: discountError } = await supabase
      .from('student_discounts')
      .select('id, student_id, fee_component, is_active')
      .eq('academic_year', '2024-2025');
    
    if (discountError) {
      console.log('❌ Error fetching discounts:', discountError.message);
      return;
    }
    
    const activeDiscounts = discounts?.filter(d => d.is_active) || [];
    const inactiveDiscounts = discounts?.filter(d => !d.is_active) || [];
    
    console.log('\n🎁 Student Discounts Status:');
    console.log(`   ✅ Active discounts: ${activeDiscounts.length}`);
    console.log(`   💤 Inactive discounts: ${inactiveDiscounts.length}`);
    
    // System health score
    const healthScore = ((classFees.length > 0 ? 25 : 0) +
                        (studentFees.length === 0 ? 25 : 0) +
                        (inconsistentFees.length === 0 ? 25 : 0) +
                        (activeDiscounts.length >= 0 ? 25 : 0));
    
    console.log(`\n🎯 System Health Score: ${healthScore}/100`);
    
    if (healthScore === 100) {
      console.log('🎉 System is healthy and ready for dynamic fee calculation!');
    } else {
      console.log('⚠️ System needs attention. Consider running cleanupFeeStructure()');
    }
    
    return healthScore;
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
}

// Export all test functions
export { quickTest as default };

console.log('🧪 Test Runner Loaded!');
console.log('Available functions:');
console.log('- quickTest() - Test with your real data');
console.log('- cleanupFeeStructure() - Clean up fee structure');
console.log('- testDiscountFlow(studentId) - Test discount creation/deletion');
console.log('- showSystemStatus() - Show system health');
