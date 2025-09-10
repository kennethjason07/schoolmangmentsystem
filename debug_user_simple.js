const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://uqsjdlwdlgvxekqcclji.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxc2pkbHdkbGd2eGVrcWNjbGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzkzOTAyNSwiZXhwIjoyMDM5NTE1MDI1fQ.5VLbLCWjJ9Ea9RNK6LFJlrMD7uF8wQO5q2iK8bOMO9M';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserTenant() {
  const emailToCheck = 'prakash01033@gmail.com';
  console.log(`🔍 Debugging tenant assignment for ${emailToCheck}`);
  
  try {
    // Check user in users table
    console.log('\n📄 Checking users table...');
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', emailToCheck);
    
    if (dbError) {
      console.error('❌ Error querying users table:', dbError);
      return;
    }
    
    if (!dbUsers || dbUsers.length === 0) {
      console.error('❌ User not found in users table');
      return;
    }
    
    console.log('✅ Found user(s) in users table:');
    dbUsers.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Tenant ID: ${user.tenant_id || 'NULL'}`);
      console.log(`     Full Name: ${user.full_name}`);
      console.log(`     Role ID: ${user.role_id}`);
    });
    
    const dbUser = dbUsers[0];
    
    if (!dbUser.tenant_id) {
      console.error('❌ User has no tenant_id assigned!');
      return;
    }
    
    // Check if the assigned tenant exists
    console.log(`\n🏢 Checking tenant: ${dbUser.tenant_id}`);
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', dbUser.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('❌ Error fetching assigned tenant:', tenantError);
      return;
    }
    
    console.log('✅ Found assigned tenant:', {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status
    });
    
    // Check what tenant TenantContext is trying to load
    console.log('\n🔍 Checking what TenantContext might be loading...');
    console.log('The issue: TenantContext loaded "Default School" (b8f8b5f0-1234-4567-8901-123456789000)');
    console.log(`But user should be in: "${tenant.name}" (${tenant.id})`);
    
    // Check if "Default School" exists
    const { data: defaultSchool, error: defaultError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', 'b8f8b5f0-1234-4567-8901-123456789000')
      .single();
    
    if (!defaultError && defaultSchool) {
      console.log('\n🏢 "Default School" tenant details:', {
        id: defaultSchool.id,
        name: defaultSchool.name,
        status: defaultSchool.status
      });
    }
    
    // Show the problem clearly
    console.log('\n🚨 PROBLEM IDENTIFIED:');
    console.log(`  - TenantContext loaded: Default School (b8f8b5f0-1234-4567-8901-123456789000)`);
    console.log(`  - User actually belongs to: ${tenant.name} (${tenant.id})`);
    console.log(`  - This is why tenant validation fails!`);
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

debugUserTenant().then(() => {
  console.log('\n🏁 Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});
