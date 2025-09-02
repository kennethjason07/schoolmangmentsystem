// Simple debug script to check leave applications
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLeaves() {
  console.log('🔍 Checking Leave Applications');
  console.log('==============================');

  try {
    // 1. Check if table exists by trying a simple query
    console.log('\n1. CHECKING TABLE EXISTENCE:');
    const { data: basicCheck, error: basicError } = await supabase
      .from('leave_applications')
      .select('id')
      .limit(1);
    
    if (basicError) {
      console.error('❌ Error accessing leave_applications table:', basicError);
      console.log('💡 This suggests the table might not exist or have permission issues');
      return;
    } else {
      console.log('✅ Table exists and accessible');
    }

    // 2. Get all records to see what's there
    console.log('\n2. CHECKING ALL RECORDS:');
    const { data: allRecords, error: allError } = await supabase
      .from('leave_applications')
      .select('*')
      .limit(20);
    
    if (allError) {
      console.error('❌ Error fetching records:', allError);
    } else {
      console.log(`📊 Found ${allRecords?.length || 0} total records`);
      if (allRecords && allRecords.length > 0) {
        console.log('\n📋 Sample records:');
        allRecords.slice(0, 5).forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}`);
          console.log(`     Teacher: ${record.teacher_id}`);
          console.log(`     Status: ${record.status}`);
          console.log(`     Dates: ${record.start_date} to ${record.end_date}`);
          console.log(`     Tenant: ${record.tenant_id || 'NULL'}`);
          console.log(`     Applied: ${record.applied_date}`);
          console.log('     ---');
        });
      }
    }

    // 3. Check for records without tenant_id
    console.log('\n3. CHECKING RECORDS WITHOUT TENANT_ID:');
    const { data: noTenantRecords, error: noTenantError } = await supabase
      .from('leave_applications')
      .select('id, teacher_id, status, start_date, tenant_id')
      .is('tenant_id', null);
    
    if (noTenantError) {
      console.error('❌ Error checking null tenant records:', noTenantError);
    } else {
      console.log(`⚠️  Records without tenant_id: ${noTenantRecords?.length || 0}`);
      if (noTenantRecords && noTenantRecords.length > 0) {
        console.log('These records won\'t be visible with tenant filtering!');
      }
    }

    // 4. Check table structure
    console.log('\n4. CHECKING TABLE STRUCTURE:');
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'leave_applications')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (columnError) {
      console.warn('⚠️  Could not fetch table structure:', columnError.message);
    } else {
      console.log('📊 Table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the check
checkLeaves().then(() => {
  console.log('\n✅ Debug completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
