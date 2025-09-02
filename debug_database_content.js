const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugDatabase() {
  console.log('🔍 DEBUGGING DATABASE CONTENT');
  console.log('=============================');

  // Check what's actually in each table
  console.log('\n1. 🎭 ALL ROLES in database:');
  const { data: allRoles, error: rolesError } = await supabase
    .from('roles')
    .select('*');
    
  if (rolesError) {
    console.log('❌ Error reading roles:', rolesError);
  } else {
    console.log(`📊 Total roles: ${allRoles.length}`);
    allRoles.forEach(role => {
      console.log(`   - ${role.role_name} (ID: ${role.id}, Tenant: ${role.tenant_id})`);
    });
  }

  console.log('\n2. 👥 ALL USERS in database:');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('*');
    
  if (usersError) {
    console.log('❌ Error reading users:', usersError);
  } else {
    console.log(`📊 Total users: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`   - ${user.email} | ${user.full_name || 'No name'} | Role: ${user.role_id} | Tenant: ${user.tenant_id}`);
    });
  }

  console.log('\n3. 🏢 ALL TENANTS in database:');
  const { data: allTenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*');
    
  if (tenantsError) {
    console.log('❌ Error reading tenants:', tenantsError);
  } else {
    console.log(`📊 Total tenants: ${allTenants.length}`);
    allTenants.forEach(tenant => {
      console.log(`   - ${tenant.name} | ${tenant.subdomain} | ID: ${tenant.id}`);
    });
  }

  // Search for the specific user with different methods
  console.log('\n4. 🔍 SEARCHING FOR kenj7214@gmail.com:');
  
  // Method 1: Exact match
  console.log('\n   Method 1: Exact email match');
  const { data: exactUser, error: exactError } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'kenj7214@gmail.com');
    
  if (exactError) {
    console.log('   ❌ Exact match error:', exactError);
  } else {
    console.log(`   📊 Exact match results: ${exactUser.length}`);
    exactUser.forEach(user => {
      console.log(`      - Found: ${user.email} | ${user.full_name} | ID: ${user.id}`);
    });
  }

  // Method 2: Case insensitive search
  console.log('\n   Method 2: Case insensitive search');
  const { data: iUser, error: iError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', 'kenj7214@gmail.com');
    
  if (iError) {
    console.log('   ❌ Case insensitive error:', iError);
  } else {
    console.log(`   📊 Case insensitive results: ${iUser.length}`);
    iUser.forEach(user => {
      console.log(`      - Found: ${user.email} | ${user.full_name} | ID: ${user.id}`);
    });
  }

  // Method 3: Contains search
  console.log('\n   Method 3: Contains search');
  const { data: containsUser, error: containsError } = await supabase
    .from('users')
    .select('*')
    .ilike('email', '%kenj7214%');
    
  if (containsError) {
    console.log('   ❌ Contains search error:', containsError);
  } else {
    console.log(`   📊 Contains search results: ${containsUser.length}`);
    containsUser.forEach(user => {
      console.log(`      - Found: ${user.email} | ${user.full_name} | ID: ${user.id}`);
    });
  }

  // Final diagnosis
  console.log('\n📋 DIAGNOSIS');
  console.log('============');
  
  if (allRoles.length === 0 && allUsers.length === 0 && allTenants.length === 0) {
    console.log('🚨 ALL TABLES ARE EMPTY!');
    console.log('💡 This suggests RLS is still blocking access or data was never inserted');
  } else if (allUsers.length === 0) {
    console.log('🚨 USERS TABLE IS EMPTY!');
    console.log('💡 The user profile you see in the dashboard might not be in the "users" table');
    console.log('💡 Check if the user is in "auth.users" instead of "public.users"');
  } else if (exactUser.length === 0) {
    console.log('🚨 SPECIFIC USER NOT FOUND!');
    console.log('💡 Check the exact email address in your database');
    console.log('💡 The user might exist with a different email or in a different table');
  } else {
    console.log('✅ Database content looks normal');
  }
}

debugDatabase().catch(console.error);
