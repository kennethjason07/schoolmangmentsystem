/**
 * IMMEDIATE Fee Concession Issue Diagnostic
 * Run this to see what's wrong with your fee structure
 */

// Use dynamic import for ES modules
async function loadSupabase() {
  const module = await import('./src/utils/supabase.js');
  return module.supabase;
}

async function diagnoseFeeIssue() {
  console.log('🔍 DIAGNOSING FEE CONCESSION ISSUE');
  console.log('='.repeat(50));
  
  try {
    const supabase = await loadSupabase();
    // Step 1: Find classes with zero fees (the problem)
    console.log('🚨 STEP 1: Looking for classes with zero fees...');
    const { data: zeroFees, error: zeroError } = await supabase
      .from('fee_structure')
      .select('id, class_id, fee_component, amount, student_id')
      .eq('amount', 0)
      .is('student_id', null) // Class-level fees that are zero
      .limit(10);
    
    if (zeroError) {
      console.error('❌ Error checking zero fees:', zeroError);
      return;
    }
    
    console.log(`Found ${zeroFees?.length || 0} class-level fees with zero amount:`);
    if (zeroFees && zeroFees.length > 0) {
      zeroFees.forEach(fee => {
        console.log(`   Class ${fee.class_id}: ${fee.fee_component} = ₹${fee.amount} (ID: ${fee.id})`);
      });
      console.log('❌ ISSUE CONFIRMED: Class fees are set to zero!');
    } else {
      console.log('✅ No zero class fees found');
    }
    console.log('');
    
    // Step 2: Look for student-specific fee entries (shouldn't exist)
    console.log('🔍 STEP 2: Looking for student-specific fee entries...');
    const { data: studentEntries, error: studentError } = await supabase
      .from('fee_structure')
      .select('id, class_id, student_id, fee_component, amount')
      .not('student_id', 'is', null) // Student-specific entries
      .limit(20);
    
    if (studentError) {
      console.error('❌ Error checking student entries:', studentError);
      return;
    }
    
    console.log(`Found ${studentEntries?.length || 0} student-specific fee entries:`);
    if (studentEntries && studentEntries.length > 0) {
      studentEntries.forEach(entry => {
        console.log(`   Student ${entry.student_id}: ${entry.fee_component} = ₹${entry.amount} (Class: ${entry.class_id})`);
      });
      console.log('❌ ISSUE CONFIRMED: Student-specific entries exist in fee_structure!');
    } else {
      console.log('✅ No student-specific fee entries found');
    }
    console.log('');
    
    // Step 3: Check student discounts
    console.log('💰 STEP 3: Checking student discounts...');
    const { data: discounts, error: discountError } = await supabase
      .from('student_discounts')
      .select('id, student_id, class_id, discount_type, discount_value, fee_component, is_active')
      .eq('is_active', true)
      .limit(10);
    
    if (discountError) {
      console.error('❌ Error checking discounts:', discountError);
      return;
    }
    
    console.log(`Found ${discounts?.length || 0} active student discounts:`);
    if (discounts && discounts.length > 0) {
      discounts.forEach(discount => {
        console.log(`   Student ${discount.student_id}: ${discount.discount_type} ${discount.discount_value} (${discount.fee_component || 'ALL'})`);
      });
    }
    console.log('');
    
    // Step 4: Show problematic classes
    if (zeroFees && zeroFees.length > 0) {
      console.log('🆘 STEP 4: Affected classes and recommended fixes:');
      const affectedClasses = [...new Set(zeroFees.map(f => f.class_id))];
      
      for (const classId of affectedClasses) {
        console.log(`\n   Class ID: ${classId}`);
        console.log('   Issues found:');
        const classZeroFees = zeroFees.filter(f => f.class_id === classId);
        classZeroFees.forEach(fee => {
          console.log(`     - ${fee.fee_component}: ₹0 (should have proper amount)`);
        });
        
        // Check if there are discounts for this class
        const classDiscounts = discounts?.filter(d => d.class_id === classId) || [];
        if (classDiscounts.length > 0) {
          console.log('   Related student discounts:');
          classDiscounts.forEach(discount => {
            console.log(`     - Student ${discount.student_id}: ${discount.discount_value} discount`);
          });
        }
      }
    }
    
    console.log('\n📋 DIAGNOSIS SUMMARY:');
    console.log('='.repeat(30));
    
    if ((zeroFees && zeroFees.length > 0) || (studentEntries && studentEntries.length > 0)) {
      console.log('❌ PROBLEMS DETECTED:');
      
      if (zeroFees && zeroFees.length > 0) {
        console.log(`   • ${zeroFees.length} class-level fees set to zero`);
        console.log('   • This affects ALL students in those classes');
      }
      
      if (studentEntries && studentEntries.length > 0) {
        console.log(`   • ${studentEntries.length} student-specific entries in fee_structure`);
        console.log('   • These should be in student_discounts table instead');
      }
      
      console.log('\n🔧 TO FIX THIS ISSUE:');
      console.log('   1. Restore class-level fees to correct amounts');
      console.log('   2. Remove student-specific entries from fee_structure');
      console.log('   3. Ensure concessions are only in student_discounts table');
      console.log('   4. Fix the fee concession creation logic');
      
    } else {
      console.log('✅ NO ISSUES DETECTED: Fee structure appears correct');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run the diagnostic
diagnoseFeeIssue();