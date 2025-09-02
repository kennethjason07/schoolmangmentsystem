const { createClient } = require('@supabase/supabase-js');

// Use the anon key (this is what we have)
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// SERVICE KEY - You need to get this from your Supabase dashboard
// Go to Settings > API in your Supabase project dashboard
// The service key is under "Project API keys" section
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY_HERE'; // Replace this with your actual service key

console.log('📋 ROLES TABLE FIX INSTRUCTIONS');
console.log('================================');
console.log('');
console.log('Your roles table is empty, which is causing the login error.');
console.log('Here are 3 ways to fix it:');
console.log('');

console.log('🔧 METHOD 1: Use the SQL Script (RECOMMENDED)');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to the SQL Editor');
console.log('3. Copy and paste the contents of "fix_roles_rls.sql"');
console.log('4. Run the SQL script');
console.log('');

console.log('🔧 METHOD 2: Use Service Key (if available)');
console.log('1. Go to Supabase dashboard > Settings > API');
console.log('2. Copy the "service_role" key (NOT the anon key)');
console.log('3. Replace YOUR_SERVICE_ROLE_KEY_HERE in this file with that key');
console.log('4. Run this script: node insert_roles_alternative.js');
console.log('');

console.log('🔧 METHOD 3: Temporarily Disable RLS');
console.log('1. Go to Supabase dashboard > Authentication > Policies');
console.log('2. Find the "roles" table and disable RLS temporarily');
console.log('3. Run the original check_roles_fix.js script');
console.log('4. Re-enable RLS after roles are created');
console.log('');

// Try with service key if provided
async function insertRolesWithServiceKey() {
  if (supabaseServiceKey === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    console.log('⚠️  Service key not provided. Please follow METHOD 1 or METHOD 3 above.');
    return;
  }

  console.log('🔧 Attempting to insert roles with service key...');
  
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  const defaultTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  
  const defaultRoles = [
    { role_name: 'Admin', tenant_id: defaultTenantId },
    { role_name: 'Teacher', tenant_id: defaultTenantId },
    { role_name: 'Parent', tenant_id: defaultTenantId },
    { role_name: 'Student', tenant_id: defaultTenantId }
  ];

  // First ensure tenant exists
  const { data: tenantData, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .upsert({
      id: defaultTenantId,
      name: 'Default School',
      subdomain: 'default',
      status: 'active',
      subscription_plan: 'enterprise',
      max_students: 1000,
      max_teachers: 100,
      max_classes: 50,
      contact_email: 'admin@school.com',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (tenantError && tenantError.code !== '23505') { // 23505 is unique violation (already exists)
    console.error('❌ Error creating tenant:', tenantError);
  } else {
    console.log('✅ Tenant verified/created');
  }
  
  // Insert roles
  for (let role of defaultRoles) {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .upsert(role)
      .select()
      .single();
      
    if (error) {
      console.error(`❌ Error creating role ${role.role_name}:`, error);
    } else {
      console.log(`✅ Created/verified role: ${role.role_name} (ID: ${data.id})`);
    }
  }

  // Verify roles were created
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('id');

  if (rolesError) {
    console.error('❌ Error fetching roles:', rolesError);
  } else {
    console.log('✅ Final roles in database:');
    roles.forEach(role => {
      console.log(`  - ${role.role_name} (ID: ${role.id})`);
    });
  }
}

// Test current state
async function testCurrentState() {
  console.log('🔍 Testing current state with anon key...');
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: roles, error } = await supabase
    .from('roles')
    .select('*');
    
  if (error) {
    console.log(`❌ Error reading roles: ${error.message}`);
  } else {
    console.log(`📊 Current roles count: ${roles.length}`);
    if (roles.length > 0) {
      roles.forEach(role => {
        console.log(`  - ${role.role_name} (ID: ${role.id})`);
      });
      console.log('🎉 Roles exist! The login should work now.');
    } else {
      console.log('⚠️  No roles found. Please follow one of the methods above.');
    }
  }
}

// Run the test
testCurrentState().then(() => {
  // Try service key method if available
  insertRolesWithServiceKey();
}).catch(console.error);
