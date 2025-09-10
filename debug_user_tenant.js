const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://uqsjdlwdlgvxekqcclji.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxc2pkbHdkbGd2eGVrcWNjbGppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMzkzOTAyNSwiZXhwIjoyMDM5NTE1MDI1fQ.5VLbLCWjJ9Ea9RNK6LFJlrMD7uF8wQO5q2iK8bOMO9M';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserTenant() {
  console.log('🔍 Debugging tenant assignment for kenj7214@gmail.com');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    // 1. Check if user exists in auth
    console.log('\n📧 Step 1: Checking auth users...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const authUser = authUsers.users.find(u => u.email === 'kenj7214@gmail.com');
    if (!authUser) {
      console.error('❌ User not found in auth users');
      return;
    }
    
    console.log('✅ Found auth user:', {
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at
    });
    
    // 2. Check if user exists in users table
    console.log('\n📄 Step 2: Checking users table...');
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('*')
      .ilike('email', 'kenj7214@gmail.com');
    
    if (dbError) {
      console.error('❌ Error querying users table:', dbError);
      return;
    }
    
    if (!dbUsers || dbUsers.length === 0) {
      console.error('❌ User not found in users table');
      console.log('🔧 This means the user record was not created properly during registration');
      return;
    }
    
    console.log('✅ Found user(s) in users table:');
    dbUsers.forEach((user, idx) => {
      console.log(`  ${idx + 1}. ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Tenant ID: ${user.tenant_id || 'NULL'}`);
      console.log(`     Full Name: ${user.full_name}`);
      console.log(`     Role ID: ${user.role_id}`);
      console.log(`     Created: ${user.created_at}`);
    });
    
    const dbUser = dbUsers[0]; // Use first match
    
    // 3. Check if user has tenant_id assigned
    if (!dbUser.tenant_id) {
      console.error('❌ User has no tenant_id assigned!');
      console.log('🔧 This user needs to be assigned to a tenant');
      
      // Show available tenants
      console.log('\n🏢 Available tenants:');
      const { data: tenants, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, name, status')
        .eq('status', 'active');
      
      if (tenantsError) {
        console.error('❌ Error fetching tenants:', tenantsError);
      } else {
        tenants.forEach((tenant, idx) => {
          console.log(`  ${idx + 1}. ${tenant.name} (${tenant.id})`);
        });
      }
      return;
    }
    
    console.log(`✅ User has tenant_id: ${dbUser.tenant_id}`);
    
    // 4. Check if the assigned tenant exists and is active
    console.log('\n🏢 Step 3: Checking assigned tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', dbUser.tenant_id)
      .single();
    
    if (tenantError) {
      console.error('❌ Error fetching assigned tenant:', tenantError);
      console.log('🔧 The user is assigned to a tenant that doesn\'t exist or is inaccessible');
      return;
    }
    
    if (!tenant) {
      console.error('❌ Assigned tenant not found');
      return;
    }
    
    console.log('✅ Found assigned tenant:', {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      subdomain: tenant.subdomain
    });
    
    if (tenant.status !== 'active') {
      console.error('❌ Assigned tenant is not active:', tenant.status);
      return;
    }
    
    console.log('\n🎉 SUCCESS: User tenant assignment is correct');
    console.log('Summary:');
    console.log(`  - Auth ID: ${authUser.id}`);
    console.log(`  - DB User ID: ${dbUser.id}`);
    console.log(`  - Email: ${dbUser.email}`);
    console.log(`  - Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`  - Status: ${tenant.status}`);
    
    // 5. Test the email-based lookup function
    console.log('\n🧪 Step 4: Testing email-based lookup...');
    
    // Try email lookup directly
    const { data: lookupResult, error: lookupError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name, role_id, created_at')
      .ilike('email', 'kenj7214@gmail.com')
      .maybeSingle();
    
    if (lookupError) {
      console.error('❌ Email lookup failed:', lookupError);
    } else if (!lookupResult) {
      console.error('❌ Email lookup returned no results');
    } else {
      console.log('✅ Email lookup successful:', {
        id: lookupResult.id,
        email: lookupResult.email,
        tenant_id: lookupResult.tenant_id,
        full_name: lookupResult.full_name
      });
      
      if (lookupResult.tenant_id === dbUser.tenant_id) {
        console.log('✅ Email lookup returned consistent tenant_id');
      } else {
        console.error('❌ Email lookup returned different tenant_id!');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

// Run the debug
debugUserTenant().then(() => {
  console.log('\n🏁 Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});
