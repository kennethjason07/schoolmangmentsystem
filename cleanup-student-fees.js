import { supabase } from './src/utils/supabase.js';

/**
 * CLEANUP SCRIPT: Remove all student-specific fee_structure entries
 * 
 * This script removes all rows from fee_structure table where student_id is NOT NULL
 * to transition to the simplified fee management system where:
 * - fee_structure contains ONLY class-level fees (student_id = null)
 * - student_discounts table manages individual student discounts
 * - Fee calculations are done dynamically by subtracting discounts from class fees
 */

async function cleanupStudentSpecificFees() {
  console.log('🧹 Starting cleanup of student-specific fee entries...');
  
  try {
    // Step 1: Count existing student-specific entries
    const { data: existingCount, error: countError } = await supabase
      .from('fee_structure')
      .select('id', { count: 'exact' })
      .not('student_id', 'is', null);
    
    if (countError) {
      console.error('❌ Error counting student-specific entries:', countError);
      return;
    }
    
    const totalStudentEntries = existingCount?.length || 0;
    console.log(`📊 Found ${totalStudentEntries} student-specific fee entries to remove`);
    
    if (totalStudentEntries === 0) {
      console.log('✅ No student-specific entries found. Database is already clean!');
      return;
    }
    
    // Step 2: Get details of what we're about to delete (for logging)
    const { data: entriesToDelete, error: detailsError } = await supabase
      .from('fee_structure')
      .select(`
        id, 
        student_id, 
        class_id, 
        academic_year, 
        fee_component, 
        amount, 
        base_amount, 
        discount_applied
      `)
      .not('student_id', 'is', null)
      .limit(10); // Just show first 10 for logging
    
    if (!detailsError && entriesToDelete) {
      console.log('📋 Sample of entries to be deleted:');
      entriesToDelete.forEach((entry, index) => {
        console.log(`   ${index + 1}. Student ${entry.student_id}: ${entry.fee_component} = ${entry.amount} (class ${entry.class_id})`);
      });
      if (totalStudentEntries > 10) {
        console.log(`   ... and ${totalStudentEntries - 10} more entries`);
      }
    }
    
    // Step 3: Confirm the operation
    console.log('⚠️  This will permanently delete all student-specific fee entries!');
    console.log('⚠️  Students will fall back to class-level fees with discounts from student_discounts table');
    console.log('🔄 Proceeding with cleanup in 3 seconds...');
    
    // Wait 3 seconds to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Perform the cleanup
    console.log('🗑️ Deleting student-specific fee entries...');
    
    const { data: deletedEntries, error: deleteError } = await supabase
      .from('fee_structure')
      .delete()
      .not('student_id', 'is', null)
      .select('id');
    
    if (deleteError) {
      console.error('❌ Error deleting student-specific entries:', deleteError);
      return;
    }
    
    const deletedCount = deletedEntries?.length || 0;
    console.log(`✅ Successfully deleted ${deletedCount} student-specific fee entries`);
    
    // Step 5: Verify cleanup
    const { data: remainingCount, error: verifyError } = await supabase
      .from('fee_structure')
      .select('id', { count: 'exact' })
      .not('student_id', 'is', null);
    
    if (!verifyError) {
      const remaining = remainingCount?.length || 0;
      if (remaining === 0) {
        console.log('✅ Cleanup verified: No student-specific entries remain');
      } else {
        console.log(`⚠️ Warning: ${remaining} student-specific entries still remain`);
      }
    }
    
    // Step 6: Show remaining class-level fees
    const { data: classFeeCount, error: classCountError } = await supabase
      .from('fee_structure')
      .select('id', { count: 'exact' })
      .is('student_id', null);
    
    if (!classCountError) {
      const classEntries = classFeeCount?.length || 0;
      console.log(`📊 Class-level fee entries remaining: ${classEntries}`);
    }
    
    console.log('🎯 Cleanup complete! Fee system is now simplified:');
    console.log('   ✅ fee_structure contains only class-level fees (student_id = null)');
    console.log('   ✅ Individual discounts managed in student_discounts table');
    console.log('   ✅ Fee calculations done dynamically (class fees - applicable discounts)');
    
  } catch (error) {
    console.error('❌ Unexpected error during cleanup:', error);
  }
}

// Run the cleanup
cleanupStudentSpecificFees()
  .then(() => {
    console.log('🏁 Cleanup script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup script failed:', error);
    process.exit(1);
  });
