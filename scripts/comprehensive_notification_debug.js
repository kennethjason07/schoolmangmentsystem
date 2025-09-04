const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';
const knownTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';

console.log('=== COMPREHENSIVE NOTIFICATION DEBUG ===\n');

async function debugNotifications() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log('📋 Target tenant_id:', knownTenantId);
    console.log('');
    
    // Test 1: Check if notifications table exists and is accessible
    console.log('🔍 TEST 1: Table accessibility');
    try {
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      
      console.log('  ✅ Notifications table accessible');
      console.log('  - Count query error:', countError?.message || 'None');
    } catch (e) {
      console.log('  ❌ Cannot access notifications table:', e.message);
      return;
    }
    
    // Test 2: Try different query approaches
    console.log('\n🔍 TEST 2: Different query approaches');
    
    // 2a: Simple select all
    const { data: allNotifs, error: allError } = await supabase
      .from('notifications')
      .select('*');
    console.log('  - Select all notifications:', allNotifs?.length || 0);
    console.log('  - Error:', allError?.message || 'None');
    
    // 2b: Select with tenant filter
    const { data: tenantNotifs, error: tenantError } = await supabase
      .from('notifications') 
      .select('*')
      .eq('tenant_id', knownTenantId);
    console.log('  - With tenant filter:', tenantNotifs?.length || 0);
    console.log('  - Error:', tenantError?.message || 'None');
    
    // 2c: Select with limit
    const { data: limitedNotifs, error: limitError } = await supabase
      .from('notifications')
      .select('id, type, message, tenant_id')
      .limit(5);
    console.log('  - With limit 5:', limitedNotifs?.length || 0);
    console.log('  - Error:', limitError?.message || 'None');
    
    // Test 3: Check table existence via information_schema (if accessible)
    console.log('\n🔍 TEST 3: Table structure verification');
    try {
      const { data: tableExists, error: tableError } = await supabase
        .rpc('check_table_exists', { table_name: 'notifications' });
      console.log('  - Table exists (RPC):', tableExists);
      console.log('  - Error:', tableError?.message || 'None');
    } catch (e) {
      console.log('  - RPC not available, trying direct schema query...');
      
      try {
        // Try to query table columns to verify structure
        const { data: columns, error: columnError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'notifications')
          .eq('table_schema', 'public');
        
        console.log('  - Table columns accessible:', !columnError);
        console.log('  - Column count:', columns?.length || 0);
      } catch (schemaError) {
        console.log('  - Schema queries not accessible');
      }
    }
    
    // Test 4: Test other tables for comparison
    console.log('\n🔍 TEST 4: Other tables comparison');
    
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, tenant_id');
    console.log('  - Users found:', users?.length || 0);
    console.log('  - Users error:', usersError?.message || 'None');
    
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name');
    console.log('  - Tenants found:', tenants?.length || 0);
    console.log('  - Tenants error:', tenantsError?.message || 'None');
    
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, tenant_id')
      .eq('tenant_id', knownTenantId);
    console.log('  - Events found:', events?.length || 0);
    console.log('  - Events error:', eventsError?.message || 'None');
    
    // Test 5: Authentication and JWT token check
    console.log('\n🔍 TEST 5: Authentication status');
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    console.log('  - Session exists:', !!session?.session);
    console.log('  - User in session:', session?.session?.user?.email || 'None');
    console.log('  - Session error:', sessionError?.message || 'None');
    
    if (session?.session) {
      console.log('  - Session JWT payload:');
      try {
        // Decode the JWT to see what's in it (basic decode, not verification)
        const token = session.session.access_token;
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('    - Role in JWT:', payload.role || 'None');
        console.log('    - Tenant in JWT:', payload.tenant_id || 'None');
        console.log('    - Email in JWT:', payload.email || 'None');
        console.log('    - User metadata:', JSON.stringify(payload.user_metadata || {}, null, 4));
      } catch (e) {
        console.log('    - Cannot decode JWT:', e.message);
      }
    }
    
    // Test 6: Try to insert a test notification to see if inserts work
    console.log('\n🔍 TEST 6: Insert test');
    try {
      const testNotif = {
        type: 'General',
        message: 'Debug test notification - ' + new Date().toISOString(),
        delivery_mode: 'InApp',
        delivery_status: 'Pending',
        tenant_id: knownTenantId,
        created_at: new Date().toISOString()
      };
      
      const { data: insertResult, error: insertError } = await supabase
        .from('notifications')
        .insert(testNotif)
        .select()
        .single();
      
      if (insertError) {
        console.log('  ❌ Insert failed:', insertError.message);
        console.log('  - Error code:', insertError.code);
        console.log('  - Error hint:', insertError.hint);
      } else {
        console.log('  ✅ Insert successful! ID:', insertResult.id);
        
        // Now try to read it back
        const { data: readBack, error: readError } = await supabase
          .from('notifications')
          .select('*')
          .eq('id', insertResult.id);
        
        console.log('  - Read back successful:', !!readBack && readBack.length > 0);
        console.log('  - Read back error:', readError?.message || 'None');
        
        if (readBack && readBack.length > 0) {
          console.log('  ✅ Can read back inserted notification!');
        } else {
          console.log('  ❌ Cannot read back inserted notification - RLS issue!');
        }
      }
    } catch (insertTestError) {
      console.log('  ❌ Insert test failed:', insertTestError.message);
    }
    
    console.log('\n=== SUMMARY ===');
    if (allNotifs && allNotifs.length > 0) {
      console.log('✅ Notifications found in database');
    } else if (allError && allError.code === '42501') {
      console.log('🔒 RLS policies are blocking access');
    } else {
      console.log('❌ No notifications in database OR RLS blocking without proper error');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

debugNotifications();
