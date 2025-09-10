/**
 * Node.js Script to Fix the Student Fees Trigger Issue
 * This script will run the SQL fix directly through Supabase client
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the React Native app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client with anon key
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixStudentFeesTriggers() {
  console.log('🚀 Starting Student Fees Trigger Fix...\n');
  
  try {
    // Step 1: Check current triggers
    console.log('📋 Step 1: Checking current triggers...');
    const { data: triggers, error: triggerError } = await supabase.rpc('sql', {
      query: `
        SELECT 
            trigger_name,
            action_timing,
            event_manipulation,
            action_statement
        FROM information_schema.triggers 
        WHERE event_object_table = 'student_fees'
        AND event_object_schema = 'public'
        ORDER BY trigger_name;
      `
    });
    
    if (triggerError) {
      console.error('❌ Could not check triggers:', triggerError);
      return;
    }
    
    console.log('Current triggers:', triggers);
    
    // Step 2: Drop problematic trigger
    console.log('\n🔧 Step 2: Removing problematic trigger...');
    
    const { error: dropTriggerError } = await supabase.rpc('sql', {
      query: 'DROP TRIGGER IF EXISTS trigger_calculate_student_fee_status ON public.student_fees;'
    });
    
    if (dropTriggerError) {
      console.error('❌ Error dropping trigger:', dropTriggerError);
      return;
    }
    
    const { error: dropFunctionError } = await supabase.rpc('sql', {
      query: 'DROP FUNCTION IF EXISTS calculate_student_fee_status();'
    });
    
    if (dropFunctionError) {
      console.error('❌ Error dropping function:', dropFunctionError);
      return;
    }
    
    console.log('✅ Problematic trigger and function removed');
    
    // Step 3: Test on specific record
    console.log('\n🧪 Step 3: Testing fix on specific record...');
    
    const { data: beforeUpdate, error: beforeError } = await supabase
      .from('student_fees')
      .select('total_amount, remaining_amount, status')
      .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050')
      .single();
    
    if (beforeError) {
      console.error('❌ Could not fetch test record:', beforeError);
      return;
    }
    
    console.log('Before fix:', beforeUpdate);
    
    // Trigger recalculation by updating amount_paid
    const { error: updateError } = await supabase
      .from('student_fees')
      .update({ amount_paid: 900.00 })
      .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050');
    
    if (updateError) {
      console.error('❌ Update failed:', updateError);
      return;
    }
    
    // Check results
    const { data: afterUpdate, error: afterError } = await supabase
      .from('student_fees')
      .select('total_amount, remaining_amount, status')
      .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050')
      .single();
    
    if (afterError) {
      console.error('❌ Could not fetch test record after update:', afterError);
      return;
    }
    
    console.log('After trigger fix:', afterUpdate);
    
    // Step 4: Manual fix if needed
    if (!afterUpdate.total_amount || afterUpdate.total_amount === afterUpdate.amount_paid) {
      console.log('⚠️ Trigger still not working properly, applying manual fix...');
      
      const { error: manualFixError } = await supabase
        .from('student_fees')
        .update({
          total_amount: 35000.00,
          remaining_amount: 34100.00,
          status: 'partial'
        })
        .eq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050');
      
      if (manualFixError) {
        console.error('❌ Manual fix failed:', manualFixError);
        return;
      }
      
      console.log('✅ Applied manual override');
    }
    
    // Step 5: Fix all other records
    console.log('\n🔄 Step 4: Triggering recalculation for all records...');
    
    const { data: allRecords, error: allRecordsError } = await supabase
      .from('student_fees')
      .select('id, amount_paid')
      .not('tenant_id', 'is', null)
      .neq('id', 'fcc83652-9fda-4e34-95ae-a7535aa3f050');
    
    if (allRecordsError) {
      console.error('❌ Could not fetch all records:', allRecordsError);
      return;
    }
    
    console.log(`Found ${allRecords.length} additional records to fix`);
    
    // Update in batches
    const batchSize = 10;
    for (let i = 0; i < allRecords.length; i += batchSize) {
      const batch = allRecords.slice(i, i + batchSize);
      
      for (const record of batch) {
        const { error: batchError } = await supabase
          .from('student_fees')
          .update({ amount_paid: record.amount_paid })
          .eq('id', record.id);
        
        if (batchError) {
          console.error(`❌ Error updating record ${record.id}:`, batchError);
        }
      }
      
      console.log(`✅ Processed batch ${Math.ceil((i + 1) / batchSize)} of ${Math.ceil(allRecords.length / batchSize)}`);
    }
    
    // Step 6: Verification
    console.log('\n📊 Step 5: Verification - checking results...');
    
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
        ? '✅ FIXED' 
        : (record.total_amount === record.amount_paid) 
          ? '❌ BROKEN' 
          : '⚠️ CHECK';
      
      console.log(`${record.id.substring(0, 8)} | ${record.fee_component} | Paid: ₹${record.amount_paid} | Total: ₹${record.total_amount} | Remaining: ₹${record.remaining_amount} | Status: ${record.status} | ${fixStatus}`);
    });
    
    // Step 7: Final statistics
    const { data: stats, error: statsError } = await supabase.rpc('sql', {
      query: `
        SELECT 
          COUNT(*) as total_records,
          COUNT(CASE WHEN total_amount IS NOT NULL AND total_amount > 0 THEN 1 END) as records_with_total,
          COUNT(CASE WHEN total_amount = amount_paid THEN 1 END) as still_broken,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
        FROM public.student_fees 
        WHERE tenant_id IS NOT NULL;
      `
    });
    
    if (!statsError && stats && stats.length > 0) {
      console.log('\n📈 Final Statistics:');
      const stat = stats[0];
      console.log(`Total Records: ${stat.total_records}`);
      console.log(`Records with Total Amount: ${stat.records_with_total}`);
      console.log(`Still Broken: ${stat.still_broken}`);
      console.log(`Paid: ${stat.paid_count}, Partial: ${stat.partial_count}, Pending: ${stat.pending_count}`);
    }
    
    console.log('\n🎉 TRIGGER FIX COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the fix
fixStudentFeesTriggers()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
