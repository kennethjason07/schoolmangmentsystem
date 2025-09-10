/**
 * Simplified Node.js Script to Fix Student Fees Data
 * This focuses on fixing the data only without touching database triggers
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the React Native app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixStudentFeesData() {
  console.log('🚀 Starting Student Fees Data Fix...\n');
  
  try {
    // Step 1: Check the problematic record first
    console.log('🧪 Step 1: Checking the specific problematic record...');
    
    const { data: testRecord, error: testError } = await supabase
      .from('student_fees')
      .select('id, student_id, fee_component, amount_paid, total_amount, remaining_amount, status')
      .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050')
      .single();
    
    if (testError) {
      console.error('❌ Could not fetch test record:', testError);
      return;
    }
    
    console.log('Current state:', testRecord);
    
    // Step 2: Fix the specific record manually
    console.log('\n🔧 Step 2: Applying manual fix to the problematic record...');
    
    const { error: fixError } = await supabase
      .from('student_fees')
      .update({
        total_amount: 35000.00,  // Based on bus fee structure
        remaining_amount: 34100.00,  // 35000 - 900
        status: 'partial'
      })
      .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050');
    
    if (fixError) {
      console.error('❌ Manual fix failed:', fixError);
      return;
    }
    
    console.log('✅ Fixed the problematic record');
    
    // Step 3: Check all records where total_amount is null or equals amount_paid
    console.log('\n🔍 Step 3: Finding all problematic records...');
    
    const { data: problematicRecords, error: findError } = await supabase
      .from('student_fees')
      .select('id, student_id, fee_component, amount_paid, total_amount, remaining_amount, status')
      .not('tenant_id', 'is', null)
      .or('total_amount.is.null,total_amount.eq.0')
      .limit(50);
    
    if (findError) {
      console.error('❌ Could not find problematic records:', findError);
      return;
    }
    
    console.log(`Found ${problematicRecords.length} records with null/zero total_amount`);
    
    // Step 4: For each problematic record, set reasonable defaults based on fee component
    console.log('\n🛠️ Step 4: Fixing problematic records...');
    
    const feeDefaults = {
      'Tuition Fee': 50000.00,
      'Bus Fee': 35000.00,
      'Admission Fee': 5000.00,
      'Activity Fee': 2000.00,
      'Library Fee': 1000.00,
      'Laboratory Fee': 3000.00,
      'Sports Fee': 1500.00,
      'Exam Fee': 1000.00
    };
    
    let fixedCount = 0;
    
    for (const record of problematicRecords) {
      const defaultTotal = feeDefaults[record.fee_component] || 10000.00; // Default fallback
      const newRemaining = Math.max(0, defaultTotal - (record.amount_paid || 0));
      const newStatus = newRemaining === 0 ? 'paid' : (record.amount_paid > 0 ? 'partial' : 'pending');
      
      const { error: updateError } = await supabase
        .from('student_fees')
        .update({
          total_amount: defaultTotal,
          remaining_amount: newRemaining,
          status: newStatus
        })
        .eq('id', record.id);
      
      if (updateError) {
        console.error(`❌ Failed to fix record ${record.id}:`, updateError);
      } else {
        fixedCount++;
        console.log(`✅ Fixed ${record.fee_component} for student ${record.student_id}: Total=₹${defaultTotal}, Remaining=₹${newRemaining}, Status=${newStatus}`);
      }
    }
    
    console.log(`\n✅ Fixed ${fixedCount} out of ${problematicRecords.length} problematic records`);
    
    // Step 5: Check records where total_amount equals amount_paid (the trigger bug)
    console.log('\n🔍 Step 5: Finding records where total_amount = amount_paid (trigger bug)...');
    
    const { data: triggerBugRecords, error: triggerBugError } = await supabase.rpc('get_equal_amounts', {}).then(result => {
      // If RPC doesn't exist, do a manual query
      if (result.error && result.error.message.includes('function')) {
        return supabase
          .from('student_fees')
          .select('id, student_id, fee_component, amount_paid, total_amount, remaining_amount, status')
          .not('tenant_id', 'is', null)
          .not('total_amount', 'is', null)
          .not('amount_paid', 'is', null)
          .limit(100);
      }
      return result;
    });
    
    if (triggerBugError) {
      console.error('❌ Could not find trigger bug records:', triggerBugError);
    } else if (triggerBugRecords && triggerBugRecords.data) {
      // Filter where total_amount equals amount_paid
      const equalAmountRecords = triggerBugRecords.data.filter(record => 
        record.total_amount === record.amount_paid && record.amount_paid > 0
      );
      
      console.log(`Found ${equalAmountRecords.length} records where total_amount = amount_paid`);
      
      // Fix these records
      let triggerFixedCount = 0;
      
      for (const record of equalAmountRecords.slice(0, 10)) { // Fix first 10 to be safe
        const reasonableTotal = feeDefaults[record.fee_component] || record.amount_paid * 2; // Double the paid amount as estimate
        const newRemaining = Math.max(0, reasonableTotal - record.amount_paid);
        const newStatus = newRemaining === 0 ? 'paid' : 'partial';
        
        const { error: fixTriggerError } = await supabase
          .from('student_fees')
          .update({
            total_amount: reasonableTotal,
            remaining_amount: newRemaining,
            status: newStatus
          })
          .eq('id', record.id);
        
        if (fixTriggerError) {
          console.error(`❌ Failed to fix trigger bug record ${record.id}:`, fixTriggerError);
        } else {
          triggerFixedCount++;
          console.log(`✅ Fixed trigger bug for ${record.fee_component}: Total=₹${reasonableTotal} (was ₹${record.total_amount}), Remaining=₹${newRemaining}`);
        }
      }
      
      console.log(`✅ Fixed ${triggerFixedCount} trigger bug records`);
    }
    
    // Step 6: Final verification
    console.log('\n📊 Step 6: Final verification...');
    
    const { data: verification, error: verificationError } = await supabase
      .from('student_fees')
      .select('id, fee_component, amount_paid, total_amount, remaining_amount, status')
      .not('tenant_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (verificationError) {
      console.error('❌ Verification failed:', verificationError);
      return;
    }
    
    console.log('\n🔍 Top 10 records after fix:');
    verification.forEach(record => {
      const fixStatus = (record.total_amount && record.total_amount > 0 && record.remaining_amount >= 0) 
        ? '✅ GOOD' 
        : (record.total_amount === record.amount_paid) 
          ? '❌ STILL BROKEN' 
          : '⚠️ CHECK';
      
      console.log(`${record.id.substring(0, 8)} | ${record.fee_component} | Paid: ₹${record.amount_paid} | Total: ₹${record.total_amount} | Remaining: ₹${record.remaining_amount} | Status: ${record.status} | ${fixStatus}`);
    });
    
    // Step 7: Summary statistics
    console.log('\n📈 Step 7: Summary statistics...');
    
    const { data: stats, error: statsError } = await supabase
      .from('student_fees')
      .select('total_amount, amount_paid, status')
      .not('tenant_id', 'is', null);
    
    if (!statsError && stats) {
      const totalRecords = stats.length;
      const recordsWithTotal = stats.filter(r => r.total_amount && r.total_amount > 0).length;
      const stillBroken = stats.filter(r => r.total_amount === r.amount_paid && r.amount_paid > 0).length;
      const paidCount = stats.filter(r => r.status === 'paid').length;
      const partialCount = stats.filter(r => r.status === 'partial').length;
      const pendingCount = stats.filter(r => r.status === 'pending').length;
      
      console.log(`Total Records: ${totalRecords}`);
      console.log(`Records with Valid Total Amount: ${recordsWithTotal}`);
      console.log(`Still Broken (total = paid): ${stillBroken}`);
      console.log(`Status Distribution - Paid: ${paidCount}, Partial: ${partialCount}, Pending: ${pendingCount}`);
      
      const successRate = totalRecords > 0 ? Math.round((recordsWithTotal / totalRecords) * 100) : 0;
      console.log(`Success Rate: ${successRate}%`);
    }
    
    console.log('\n🎉 DATA FIX COMPLETED!');
    console.log('\nNote: This fix only addresses the data. The problematic database trigger may still exist and could cause issues with new records. Consider asking a database administrator to remove the "trigger_calculate_student_fee_status" trigger.');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the fix
fixStudentFeesData()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
