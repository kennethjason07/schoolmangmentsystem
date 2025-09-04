/**
 * Debug script to test leave management functionality
 * This script will help debug issues with the leave applications system
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration (using actual values from your project)
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLeaveApplications() {
  console.log('🚀 [TEST] Starting leave applications debug test...');
  
  try {
    // Test 1: Check if leave_applications table exists and is accessible
    console.log('\n📋 [TEST] Test 1: Checking leave_applications table access...');
    
    const { data: leaveApps, error: leaveError, count } = await supabase
      .from('leave_applications')
      .select('*', { count: 'exact' })
      .limit(5);
    
    console.log('📊 [TEST] Leave applications query result:');
    console.log('   - Records found:', leaveApps?.length || 0);
    console.log('   - Total count:', count);
    console.log('   - Error:', leaveError?.message || 'None');
    console.log('   - Error code:', leaveError?.code || 'None');
    console.log('   - Sample data:', leaveApps?.slice(0, 2));
    
    if (leaveError) {
      console.error('❌ [TEST] Leave applications table access failed:', leaveError);
      
      if (leaveError.code === '42501') {
        console.log('🔒 [TEST] RLS is blocking access to leave_applications table');
      }
      
      return;
    }
    
    // Test 2: Check joined query (what the app actually uses)
    console.log('\n📋 [TEST] Test 2: Checking joined query with teachers and users...');
    
    const { data: joinedApps, error: joinError } = await supabase
      .from('leave_applications')
      .select(`
        *,
        teacher:teachers!leave_applications_teacher_id_fkey(name),
        applied_by_user:users!leave_applications_applied_by_fkey(full_name)
      `)
      .limit(5);
    
    console.log('📊 [TEST] Joined query result:');
    console.log('   - Records found:', joinedApps?.length || 0);
    console.log('   - Error:', joinError?.message || 'None');
    console.log('   - Error code:', joinError?.code || 'None');
    console.log('   - Sample joined data:', joinedApps?.slice(0, 1));
    
    if (joinError) {
      console.error('❌ [TEST] Joined query failed:', joinError);
      return;
    }
    
    // Test 3: Check if we can insert a test record
    console.log('\n📋 [TEST] Test 3: Testing insert capability...');
    
    const testRecord = {
      leave_type: 'Sick',
      start_date: '2024-12-01',
      end_date: '2024-12-02',
      reason: 'Debug test application',
      status: 'Pending',
      applied_date: new Date().toISOString().split('T')[0],
      applied_by: '00000000-0000-0000-0000-000000000000', // Test UUID
      teacher_id: null // Allow null for test
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('leave_applications')
      .insert(testRecord)
      .select();
    
    console.log('📊 [TEST] Insert test result:');
    console.log('   - Inserted data:', insertData);
    console.log('   - Error:', insertError?.message || 'None');
    console.log('   - Error code:', insertError?.code || 'None');
    
    if (insertError) {
      console.error('❌ [TEST] Insert test failed:', insertError);
      
      if (insertError.code === '42501') {
        console.log('🔒 [TEST] RLS is blocking insert to leave_applications table');
      }
      
      if (insertError.code === '23503') {
        console.log('🔗 [TEST] Foreign key constraint error - invalid applied_by or teacher_id');
      }
    } else {
      console.log('✅ [TEST] Insert test successful, cleaning up...');
      
      // Clean up the test record
      const { error: deleteError } = await supabase
        .from('leave_applications')
        .delete()
        .eq('id', insertData[0].id);
      
      if (deleteError) {
        console.log('⚠️ [TEST] Warning: Could not clean up test record:', deleteError.message);
      } else {
        console.log('🗑️ [TEST] Test record cleaned up successfully');
      }
    }
    
    // Test 4: Check table schema
    console.log('\n📋 [TEST] Test 4: Checking table schema...');
    
    // This will fail with an empty result but show us the column structure in the error
    const { data: schemaData, error: schemaError } = await supabase
      .from('leave_applications')
      .select('id, leave_type, start_date, end_date, reason, status, applied_date, applied_by, teacher_id, created_at')
      .limit(1);
    
    console.log('📊 [TEST] Schema check result:');
    console.log('   - Schema data:', schemaData);
    console.log('   - Schema error:', schemaError?.message || 'None');
    
    // Test 5: Check current user session
    console.log('\n📋 [TEST] Test 5: Checking current user session...');
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('📊 [TEST] Session check result:');
    console.log('   - Session exists:', !!session);
    console.log('   - User email:', session?.user?.email || 'Not logged in');
    console.log('   - User ID:', session?.user?.id || 'None');
    console.log('   - Session error:', sessionError?.message || 'None');
    
    if (!session) {
      console.log('⚠️ [TEST] No active session - this may cause RLS issues');
    }
    
    console.log('\n✅ [TEST] Leave applications debug test completed!');
    
  } catch (error) {
    console.error('💥 [TEST] Debug test failed:', error);
    console.error('💥 [TEST] Error stack:', error.stack);
  }
}

// Run the test
console.log('🔧 [TEST] Starting leave management debug diagnostics...');
testLeaveApplications()
  .then(() => {
    console.log('🎯 [TEST] Debug test completed');
  })
  .catch(error => {
    console.error('💥 [TEST] Debug test crashed:', error);
  });
