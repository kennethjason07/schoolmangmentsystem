const { createClient } = require('@supabase/supabase-js');

// Supabase configuration from the app
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugTenantLoadingIssue() {
  console.log('🔍 Debugging tenant loading issue for user: Arshadpatel1431@gmail.com\n');
  
  const userEmail = 'Arshadpatel1431@gmail.com';
  
  try {
    // Step 1: Check if user record exists with tenant_id
    console.log('📋 Step 1: Checking user record in database...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, role_id, created_at')
      .eq('email', userEmail)
      .maybeSingle();
    
    if (userError) {
      console.error('❌ Error querying user record:', userError);
      return;
    }
    
    if (!userRecord) {
      console.log('❌ No user record found for email:', userEmail);
      return;
    }
    
    console.log('✅ User record found:', {
      id: userRecord.id,
      email: userRecord.email,
      tenant_id: userRecord.tenant_id,
      full_name: userRecord.full_name,
      role_id: userRecord.role_id,
      created_at: userRecord.created_at
    });
    
    if (!userRecord.tenant_id) {
      console.log('❌ User record exists but tenant_id is null/empty');
      return;
    }
    
    // Step 2: Check if the tenant exists and is active
    console.log('\n📋 Step 2: Checking tenant record...');
    const { data: tenantRecord, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', userRecord.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('❌ Error querying tenant record:', tenantError);
      console.log('🔍 This could be the issue - tenant_id exists but tenant record does not');
      return;
    }
    
    if (!tenantRecord) {
      console.log('❌ Tenant record not found for tenant_id:', userRecord.tenant_id);
      console.log('🔍 This is the issue - orphaned tenant_id reference');
      return;
    }
    
    console.log('✅ Tenant record found:', {
      id: tenantRecord.id,
      name: tenantRecord.name,
      subdomain: tenantRecord.subdomain,
      status: tenantRecord.status,
      created_at: tenantRecord.created_at
    });
    
    if (tenantRecord.status !== 'active') {
      console.log('⚠️ Tenant exists but is not active - status:', tenantRecord.status);
    }
    
    // Step 3: Test the email lookup function manually
    console.log('\n📋 Step 3: Testing email lookup function logic...');
    
    // Simulate the getTenantIdByEmail function
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail)) {
      console.log('❌ Email format validation failed');
      return;
    }
    
    console.log('✅ Email format valid');
    console.log('✅ User record lookup would succeed');
    console.log('✅ Tenant_id found in user record:', userRecord.tenant_id);
    console.log('✅ Tenant record lookup would succeed');
    console.log('✅ Tenant status check:', tenantRecord.status === 'active' ? 'PASS' : 'FAIL');
    
    // Step 4: Check authentication status (this won't work in Node.js, but we can simulate)
    console.log('\n📋 Step 4: Simulating authentication check...');
    console.log('🔍 In React Native, this would call supabase.auth.getUser()');
    console.log('🔍 If user is authenticated, getTenantIdByEmail should work');
    
    // Step 5: Check for potential RLS issues
    console.log('\n📋 Step 5: Checking for potential RLS or permission issues...');
    
    // Test if we can query users table without authentication
    const { data: testUsers, error: testUsersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (testUsersError) {
      console.log('❌ Cannot query users table without auth (RLS enabled):', testUsersError.message);
      console.log('🔍 This might be the issue - RLS policies preventing access');
    } else {
      console.log('✅ Can query users table without authentication');
    }
    
    // Step 6: Recommendations
    console.log('\n💡 DIAGNOSTIC SUMMARY:');
    console.log('   User Email:', userEmail);
    console.log('   User ID:', userRecord.id);
    console.log('   Tenant ID:', userRecord.tenant_id);
    console.log('   Tenant Name:', tenantRecord.name);
    console.log('   Tenant Status:', tenantRecord.status);
    
    if (tenantRecord.status === 'active') {
      console.log('\n✅ Data looks correct in database. Possible issues:');
      console.log('   1. RLS policies preventing access during tenant lookup');
      console.log('   2. Authentication state not properly set when getTenantIdByEmail is called');
      console.log('   3. Case sensitivity in email matching');
      console.log('   4. Async timing issues in React Native tenant context loading');
      
      console.log('\n🔧 RECOMMENDED DEBUGGING STEPS:');
      console.log('   1. Add more console logs in getTenantByEmail.js');
      console.log('   2. Check if supabase.auth.getUser() is returning the user in React Native');
      console.log('   3. Verify TenantContext is calling getCurrentUserTenantByEmail properly');
      console.log('   4. Check for any error suppression in TenantContext error handling');
    } else {
      console.log('\n⚠️ ISSUE FOUND: Tenant is not active');
      console.log('   Current status:', tenantRecord.status);
      console.log('   Set tenant status to "active" to fix this issue');
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during tenant debug:', error);
  }
}

// Run the debug
debugTenantLoadingIssue().then(() => {
  console.log('\n🏁 Tenant loading debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
