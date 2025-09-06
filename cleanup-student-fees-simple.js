import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create simple Supabase client for Node.js
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * CLEANUP SCRIPT: Remove all student-specific fee_structure entries
 * 
 * This script removes all rows from fee_structure table where student_id is NOT NULL
 * to transition to the simplified fee management system
 */

async function cleanupStudentSpecificFees() {
  console.log('🧹 Starting cleanup of student-specific fee entries...');
  
  try {
    // Step 1: Count existing student-specific entries
    const { count: totalStudentEntries, error: countError } = await supabase
      .from('fee_structure')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null);
    
    if (countError) {
      console.error('❌ Error counting student-specific entries:', countError);
      return;
    }
    
    console.log(`📊 Found ${totalStudentEntries || 0} student-specific fee entries to remove`);
    
    if (!totalStudentEntries || totalStudentEntries === 0) {
      console.log('✅ No student-specific entries found. Database is already clean!');
      return;
    }
    
    // Step 2: Get sample of entries to delete (for logging)
    const { data: sampleEntries, error: sampleError } = await supabase
      .from('fee_structure')
      .select('id, student_id, class_id, academic_year, fee_component, amount')
      .not('student_id', 'is', null)
      .limit(5);
    
    if (!sampleError && sampleEntries && sampleEntries.length > 0) {
      console.log('📋 Sample of entries to be deleted:');
      sampleEntries.forEach((entry, index) => {
        console.log(`   ${index + 1}. Student ${entry.student_id}: ${entry.fee_component} = ${entry.amount} (class ${entry.class_id})`);
      });
      if (totalStudentEntries > 5) {
        console.log(`   ... and ${totalStudentEntries - 5} more entries`);
      }
    }
    
    // Step 3: Confirm the operation
    console.log('⚠️  This will permanently delete all student-specific fee entries!');
    console.log('⚠️  Students will fall back to class-level fees with discounts from student_discounts table');
    console.log('🔄 Proceeding with cleanup in 3 seconds...');
    
    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 4: Perform the cleanup
    console.log('🗑️ Deleting student-specific fee entries...');
    
    const { count: deletedCount, error: deleteError } = await supabase
      .from('fee_structure')
      .delete({ count: 'exact' })
      .not('student_id', 'is', null);
    
    if (deleteError) {
      console.error('❌ Error deleting student-specific entries:', deleteError);
      return;
    }
    
    console.log(`✅ Successfully deleted ${deletedCount || 0} student-specific fee entries`);
    
    // Step 5: Verify cleanup
    const { count: remaining, error: verifyError } = await supabase
      .from('fee_structure')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null);
    
    if (!verifyError) {
      if (!remaining || remaining === 0) {
        console.log('✅ Cleanup verified: No student-specific entries remain');
      } else {
        console.log(`⚠️ Warning: ${remaining} student-specific entries still remain`);
      }
    }
    
    // Step 6: Show remaining class-level fees
    const { count: classEntries, error: classCountError } = await supabase
      .from('fee_structure')
      .select('*', { count: 'exact', head: true })
      .is('student_id', null);
    
    if (!classCountError) {
      console.log(`📊 Class-level fee entries remaining: ${classEntries || 0}`);
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
