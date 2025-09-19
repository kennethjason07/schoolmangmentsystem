/**
 * Fix Script for Fee Concession Issue
 * 
 * This script fixes issues where student-specific fee entries were incorrectly
 * created when applying fee concessions, which should only be stored in the
 * student_discounts table.
 */

import { supabase, TABLES } from './src/utils/supabase.js';

async function fixFeeConcessionIssue() {
  console.log('🔧 FIX: Fee Concession Issue');
  console.log('='.repeat(50));
  
  try {
    // Step 1: Identify all student-specific fee entries
    console.log('🔍 STEP 1: Identifying student-specific fee entries');
    const { data: studentFees, error: studentFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, student_id, class_id, academic_year')
      .not('student_id', 'is', null) // Only student-specific fees
      .order('class_id, student_id, fee_component');
    
    if (studentFeeError) {
      console.error('❌ Error fetching student-specific fees:', studentFeeError);
      return;
    }
    
    console.log(`📋 Found ${studentFees?.length || 0} student-specific fee entries`);
    
    if (!studentFees || studentFees.length === 0) {
      console.log('✅ No student-specific fee entries found - system is clean');
      return;
    }
    
    // Group by class and student for better display
    const groupedEntries = {};
    studentFees.forEach(fee => {
      const key = `${fee.class_id}-${fee.student_id}`;
      if (!groupedEntries[key]) {
        groupedEntries[key] = {
          classId: fee.class_id,
          studentId: fee.student_id,
          entries: []
        };
      }
      groupedEntries[key].entries.push(fee);
    });
    
    console.log('📊 Student-specific fee entries by class and student:');
    Object.values(groupedEntries).forEach(group => {
      console.log(`   Class: ${group.classId}, Student: ${group.studentId}`);
      group.entries.forEach(entry => {
        console.log(`     ${entry.fee_component}: ₹${entry.amount} (ID: ${entry.id})`);
      });
    });
    console.log('');
    
    // Step 2: Check if corresponding discounts exist in student_discounts table
    console.log('🔍 STEP 2: Checking for corresponding discounts');
    const discountChecks = [];
    
    for (const fee of studentFees) {
      const { data: discounts, error: discountError } = await supabase
        .from(TABLES.STUDENT_DISCOUNTS)
        .select('*')
        .eq('student_id', fee.student_id)
        .eq('class_id', fee.class_id)
        .eq('academic_year', fee.academic_year)
        .eq('fee_component', fee.fee_component)
        .eq('is_active', true);
      
      if (discountError) {
        console.error(`❌ Error checking discounts for fee ${fee.id}:`, discountError);
        continue;
      }
      
      discountChecks.push({
        feeEntry: fee,
        hasMatchingDiscount: discounts && discounts.length > 0,
        discounts: discounts || []
      });
    }
    
    console.log(`📋 Checked ${discountChecks.length} student-specific fee entries`);
    
    const entriesWithDiscounts = discountChecks.filter(check => check.hasMatchingDiscount);
    const entriesWithoutDiscounts = discountChecks.filter(check => !check.hasMatchingDiscount);
    
    console.log(`✅ ${entriesWithDiscounts.length} entries have matching discounts`);
    console.log(`⚠️ ${entriesWithoutDiscounts.length} entries do NOT have matching discounts`);
    
    if (entriesWithoutDiscounts.length > 0) {
      console.log('   Entries without matching discounts:');
      entriesWithoutDiscounts.forEach(check => {
        const fee = check.feeEntry;
        console.log(`     Student ${fee.student_id}, ${fee.fee_component}: ₹${fee.amount}`);
      });
    }
    console.log('');
    
    // Step 3: Create missing discounts for entries that should have them
    console.log('🔧 STEP 3: Creating missing discounts');
    let createdDiscounts = 0;
    
    for (const check of entriesWithDiscounts) {
      const fee = check.feeEntry;
      const existingDiscount = check.discounts[0]; // Take the first one
      
      // Check if we need to create a discount based on the fee entry
      // This would be the case if the fee entry represents a discounted amount
      // We would need to calculate what the original discount should be
      
      // For now, we'll just log what we found
      console.log(`   Fee entry ${fee.id}: ${fee.fee_component} = ₹${fee.amount}`);
      console.log(`   Matching discount: ${existingDiscount?.discount_type} ${existingDiscount?.discount_value}`);
    }
    console.log('');
    
    // Step 4: Remove student-specific fee entries
    console.log('🗑️ STEP 4: Removing student-specific fee entries');
    console.log('   This will NOT affect the actual fee structure, only remove incorrect entries');
    
    const feeIdsToRemove = studentFees.map(fee => fee.id);
    console.log(`   Removing ${feeIdsToRemove.length} student-specific fee entries...`);
    
    // Show what will be removed
    console.log('   Entries to be removed:');
    studentFees.forEach(fee => {
      console.log(`     ID: ${fee.id}, Student: ${fee.student_id}, Component: ${fee.fee_component}, Amount: ₹${fee.amount}`);
    });
    
    // Confirm before proceeding
    console.log('\n⚠️  ABOUT TO DELETE STUDENT-SPECIFIC FEE ENTRIES');
    console.log('   This will clean up incorrectly created entries but will NOT affect actual fee calculations');
    console.log('   Fee calculations should be done dynamically using class fees + student discounts');
    
    // In a real implementation, you would uncomment the following lines:
    /*
    const { error: deleteError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .delete()
      .in('id', feeIdsToRemove);
    
    if (deleteError) {
      console.error('❌ Error removing student-specific fee entries:', deleteError);
      return;
    }
    
    console.log(`✅ Successfully removed ${feeIdsToRemove.length} student-specific fee entries`);
    */
    
    console.log('🚫 Deletion commented out for safety - uncomment lines above to actually delete');
    console.log('');
    
    // Step 5: Verify class-level fees are intact
    console.log('🔍 STEP 5: Verifying class-level fees');
    
    // Get a sample of class-level fees to verify they're intact
    const { data: classFees, error: classFeeError } = await supabase
      .from(TABLES.FEE_STRUCTURE)
      .select('id, fee_component, amount, class_id, academic_year')
      .is('student_id', null) // Only class-level fees
      .limit(10);
    
    if (classFeeError) {
      console.error('❌ Error fetching class-level fees:', classFeeError);
    } else {
      console.log(`✅ Found ${classFees?.length || 0} sample class-level fees:`);
      classFees.forEach(fee => {
        console.log(`   Class ${fee.class_id}, ${fee.fee_component}: ₹${fee.amount}`);
      });
    }
    console.log('');
    
    // Step 6: Summary and recommendations
    console.log('🏁 SUMMARY AND RECOMMENDATIONS:');
    console.log('='.repeat(50));
    
    console.log(`🔍 DIAGNOSIS:`);
    console.log(`   - Found ${studentFees?.length || 0} student-specific fee entries`);
    console.log(`   - ${entriesWithDiscounts.length} have matching discounts`);
    console.log(`   - ${entriesWithoutDiscounts.length} do NOT have matching discounts`);
    
    console.log(`\n🔧 RECOMMENDATIONS:`);
    console.log(`   1. Student-specific fee entries should NOT exist in the fee_structure table`);
    console.log(`   2. All concessions should be stored ONLY in the student_discounts table`);
    console.log(`   3. Fee calculations should be done dynamically by combining:`);
    console.log(`      - Class-level fees from fee_structure (where student_id IS NULL)`);
    console.log(`      - Individual student discounts from student_discounts table`);
    console.log(`   4. To fix this issue:`);
    console.log(`      - Remove student-specific fee entries from fee_structure table`);
    console.log(`      - Ensure all concessions are properly stored in student_discounts table`);
    console.log(`      - Verify fee calculation logic uses the correct approach`);
    
    console.log(`\n✅ NEXT STEPS:`);
    console.log(`   1. Review the fee concession creation logic in your application`);
    console.log(`   2. Ensure it only inserts into student_discounts table`);
    console.log(`   3. Uncomment the deletion code above to remove incorrect entries`);
    console.log(`   4. Test applying a new concession to verify it works correctly`);
    
  } catch (error) {
    console.error('❌ Fix process failed:', error);
  }
}

// Instructions for running
console.log(`
📝 TO RUN THIS FIX:

1. Review the code to understand what it does
2. Uncomment the deletion lines when you're ready to proceed
3. Run: node fix_fee_concession_issue.js

⚠️  WARNING:
   This script will remove student-specific fee entries from the fee_structure table.
   Make sure you understand the implications and have backups before proceeding.

📋 WHAT THIS FIX DOES:
   - Identifies incorrectly created student-specific fee entries
   - Checks if corresponding discounts exist in student_discounts table
   - Removes student-specific entries that should not exist
   - Preserves class-level fees which are correct

🎯 GOAL:
   Ensure the fee concession system works correctly by:
   - Only storing concessions in student_discounts table
   - Calculating fees dynamically from class fees + student discounts
   - Not modifying the fee_structure table when applying concessions
`);

// Export for use
export { fixFeeConcessionIssue };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixFeeConcessionIssue();
}