const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testUserAccess() {
  console.log('🔍 Testing User Access for kenj7214@gmail.com');
  console.log('==============================================');

  const userEmail = 'kenj7214@gmail.com';
  
  // Test 1: Check roles access
  console.log('\n1. 🎭 Testing roles table access...');
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('*')
    .limit(5);
    
  if (rolesError) {
    console.log('❌ Cannot read roles:', rolesError.code, rolesError.message);
  } else {
    console.log(`✅ Can read roles: ${roles.length} found`);
    roles.forEach(role => {
      console.log(`   - ${role.role_name} (ID: ${role.id})`);
    });
  }
  
  // Test 2: Check users access
  console.log('\n2. 👤 Testing users table access...');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .limit(5);
    
  if (usersError) {
    console.log('❌ Cannot read users table:', usersError.code, usersError.message);
  } else {
    console.log(`✅ Can read users table: ${users.length} users found`);
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.full_name || 'No name'})`);
    });
  }
  
  // Test 3: Check specific user
  console.log('\n3. 🎯 Testing specific user lookup...');
  const { data: specificUser, error: specificError } = await supabase
    .from('users')
    .select('*')
    .eq('email', userEmail)
    .single();
    
  if (specificError) {
    console.log('❌ Cannot find specific user:', specificError.code, specificError.message);
    
    if (specificError.code === 'PGRST116') {
      console.log('🔍 User not found in database - check if email is correct');
    } else if (specificError.code === '42501') {
      console.log('🚨 RLS is still blocking user access!');
      console.log('💡 You need to run the fix_rls_policies_complete.sql script');
    }
  } else {
    console.log('✅ Found specific user:');
    console.log(`   - ID: ${specificUser.id}`);
    console.log(`   - Email: ${specificUser.email}`);
    console.log(`   - Name: ${specificUser.full_name || 'No name'}`);
    console.log(`   - Role ID: ${specificUser.role_id}`);
    console.log(`   - Tenant ID: ${specificUser.tenant_id}`);
  }
  
  // Test 4: Check tenants
  console.log('\n4. 🏢 Testing tenants table access...');
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')
    .limit(3);
    
  if (tenantsError) {
    console.log('❌ Cannot read tenants:', tenantsError.code, tenantsError.message);
  } else {
    console.log(`✅ Can read tenants: ${tenants.length} found`);
    tenants.forEach(tenant => {
      console.log(`   - ${tenant.name} (${tenant.subdomain})`);
    });
  }
  
  // Summary
  console.log('\n📋 SUMMARY');
  console.log('==========');
  
  const canReadRoles = !rolesError;
  const canReadUsers = !usersError;
  const canFindUser = !specificError;
  const canReadTenants = !tenantsError;
  
  console.log(`Roles access: ${canReadRoles ? '✅' : '❌'}`);
  console.log(`Users access: ${canReadUsers ? '✅' : '❌'}`);
  console.log(`Find specific user: ${canFindUser ? '✅' : '❌'}`);
  console.log(`Tenants access: ${canReadTenants ? '✅' : '❌'}`);
  
  if (canReadRoles && canReadUsers && canFindUser && canReadTenants) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ Your login should work perfectly now!');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('💡 Run the fix_rls_policies_complete.sql script in Supabase SQL Editor');
    console.log('📝 This will fix the RLS policies blocking access to these tables');
  }
}

testUserAccess().catch(console.error);
