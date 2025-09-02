// Simple debug script to test leave functionality
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const TABLES = {
  LEAVE_APPLICATIONS: 'leave_applications'
};

async function debugLeaves() {
  console.log('🔍 DEBUGGING LEAVE APPLICATIONS');
  console.log('================================');

  try {
    // 1. Check authentication
    console.log('\n1. CHECKING AUTHENTICATION:');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    console.log('✅ User authenticated:', user ? `${user.email} (${user.id})` : 'No user');
    
    // 2. Check tenant ID
    console.log('\n2. CHECKING TENANT ID:');
    const tenantId = await getUserTenantId();
    console.log('🏢 Current tenant ID:', tenantId);
    
    if (!tenantId) {
      console.warn('⚠️  No tenant ID found - this could be the issue!');
    }

    // 3. Check user metadata
    console.log('\n3. CHECKING USER METADATA:');
    if (user) {
      console.log('📋 App metadata:', JSON.stringify(user.app_metadata, null, 2));
      console.log('📋 User metadata:', JSON.stringify(user.user_metadata, null, 2));
    }

    // 4. Check if leave_applications table exists and has data
    console.log('\n4. CHECKING LEAVE_APPLICATIONS TABLE:');
    
    // First, check table structure
    const { data: tableInfo, error: tableError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'leave_applications')
      .eq('table_schema', 'public');
    
    if (tableError) {
      console.error('❌ Error checking table structure:', tableError);
    } else {
      console.log('📊 Table columns:', tableInfo);
    }

    // 5. Check total records in table (without tenant filter)
    console.log('\n5. CHECKING ALL RECORDS IN TABLE:');
    const { data: allRecords, error: allError } = await supabase
      .from(TABLES.LEAVE_APPLICATIONS)
      .select('id, teacher_id, status, start_date, end_date, tenant_id, applied_date')
      .limit(10);
    
    if (allError) {
      console.error('❌ Error fetching all records:', allError);
    } else {
      console.log(`📈 Total records found: ${allRecords?.length || 0}`);
      if (allRecords && allRecords.length > 0) {
        console.log('📋 Sample records:');
        allRecords.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}, Tenant: ${record.tenant_id}, Status: ${record.status}, Date: ${record.start_date}`);
        });
      }
    }

    // 6. Check records with current tenant filter
    if (tenantId) {
      console.log('\n6. CHECKING RECORDS WITH TENANT FILTER:');
      const { data: tenantRecords, error: tenantError } = await supabase
        .from(TABLES.LEAVE_APPLICATIONS)
        .select('id, teacher_id, status, start_date, end_date, tenant_id')
        .eq('tenant_id', tenantId);
      
      if (tenantError) {
        console.error('❌ Error fetching tenant records:', tenantError);
      } else {
        console.log(`📈 Records for tenant ${tenantId}: ${tenantRecords?.length || 0}`);
        if (tenantRecords && tenantRecords.length > 0) {
          console.log('📋 Tenant records:');
          tenantRecords.forEach((record, index) => {
            console.log(`  ${index + 1}. ID: ${record.id}, Status: ${record.status}, Date: ${record.start_date}`);
          });
        }
      }
    }

    // 7. Test the leave service
    console.log('\n7. TESTING LEAVE SERVICE:');
    const leaveResult = await leaveService.getLeaveApplications();
    console.log('🔍 Leave service result:', {
      success: leaveResult.success,
      dataLength: leaveResult.data?.length || 0,
      error: leaveResult.error,
      message: leaveResult.message
    });

    // 8. Check for any missing tenant_id records
    console.log('\n8. CHECKING FOR RECORDS WITHOUT TENANT_ID:');
    const { data: noTenantRecords, error: noTenantError } = await supabase
      .from(TABLES.LEAVE_APPLICATIONS)
      .select('id, teacher_id, status, start_date')
      .is('tenant_id', null)
      .limit(5);
    
    if (noTenantError) {
      console.error('❌ Error checking null tenant records:', noTenantError);
    } else {
      console.log(`📊 Records without tenant_id: ${noTenantRecords?.length || 0}`);
      if (noTenantRecords && noTenantRecords.length > 0) {
        console.log('⚠️  Found records without tenant_id - these won\'t show up!');
        noTenantRecords.forEach((record, index) => {
          console.log(`  ${index + 1}. ID: ${record.id}, Status: ${record.status}, Date: ${record.start_date}`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
}

// Run the debug script
debugLeaves().then(() => {
  console.log('\n🏁 Debug script completed');
}).catch(error => {
  console.error('💥 Debug script failed:', error);
});
