const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🚨 EMERGENCY DIAGNOSIS AND FIX');
console.log('===============================');

async function diagnoseIssue() {
  console.log('\n1. 🔍 Checking database connection...');
  
  try {
    // Test basic connection
    const { data, error } = await supabase.from('roles').select('count', { count: 'exact' });
    
    if (error) {
      console.error('❌ Database connection error:', error);
      console.log('\n💡 POSSIBLE SOLUTIONS:');
      console.log('- Check your internet connection');
      console.log('- Verify Supabase URL and API key are correct');
      console.log('- Check if the roles table exists in your database');
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log(`📊 Roles table count: ${data.length}`);
    
  } catch (err) {
    console.error('💥 Connection test failed:', err.message);
    return false;
  }

  console.log('\n2. 🔍 Checking roles table structure...');
  
  try {
    // Try to get table info
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('*')
      .limit(1);
    
    if (rolesError) {
      console.error('❌ Error querying roles table:', rolesError);
      
      if (rolesError.code === '42P01') {
        console.log('\n🚨 CRITICAL: The "roles" table does not exist!');
        console.log('💡 You need to create the database schema first.');
        console.log('📋 Run the database migration scripts to create all tables.');
        return false;
      }
      
      if (rolesError.code === '42501') {
        console.log('\n🚨 CRITICAL: Row Level Security (RLS) is blocking access to roles table!');
        console.log('💡 SOLUTION: You must run the SQL script with admin privileges.');
        return false;
      }
      
      return false;
    }
    
    console.log('✅ Roles table exists and is accessible');
    console.log(`📊 Current roles in table: ${roles.length}`);
    
    if (roles.length > 0) {
      console.log('📋 Existing roles:');
      roles.forEach(role => {
        console.log(`  - ${role.role_name} (ID: ${role.id})`);
      });
    }
    
  } catch (err) {
    console.error('💥 Table structure check failed:', err.message);
    return false;
  }

  console.log('\n3. 🔍 Checking tenants table...');
  
  try {
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(5);
    
    if (tenantsError) {
      console.error('❌ Error querying tenants table:', tenantsError);
      
      if (tenantsError.code === '42P01') {
        console.log('🚨 CRITICAL: The "tenants" table does not exist!');
        return false;
      }
      
      return false;
    }
    
    console.log('✅ Tenants table exists');
    console.log(`📊 Tenants found: ${tenants.length}`);
    
    if (tenants.length > 0) {
      console.log('🏫 Existing tenants:');
      tenants.forEach(tenant => {
        console.log(`  - ${tenant.name} (ID: ${tenant.id})`);
      });
    } else {
      console.log('⚠️  No tenants found - this could be the issue!');
    }
    
  } catch (err) {
    console.error('💥 Tenants check failed:', err.message);
    return false;
  }

  return true;
}

async function attemptDirectFix() {
  console.log('\n4. 🔧 Attempting direct fix with RLS bypass techniques...');
  
  const defaultTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  
  // Try to insert tenant first
  console.log('📝 Attempting to create default tenant...');
  try {
    const tenantData = {
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
    };
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .upsert(tenantData, { onConflict: 'id' })
      .select()
      .single();
    
    if (tenantError) {
      console.error('❌ Failed to create tenant:', tenantError);
      if (tenantError.code === '42501') {
        console.log('🚨 RLS is blocking tenant creation - you MUST run the SQL script in Supabase dashboard');
      }
    } else {
      console.log('✅ Tenant created/verified successfully');
    }
  } catch (err) {
    console.error('💥 Tenant creation failed:', err.message);
  }
  
  // Try to insert roles
  console.log('\n📝 Attempting to create roles...');
  const roles = [
    { role_name: 'Admin', tenant_id: defaultTenantId },
    { role_name: 'Teacher', tenant_id: defaultTenantId },
    { role_name: 'Parent', tenant_id: defaultTenantId },
    { role_name: 'Student', tenant_id: defaultTenantId }
  ];
  
  let successCount = 0;
  
  for (const roleData of roles) {
    try {
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .upsert(roleData, { onConflict: 'role_name' })
        .select()
        .single();
      
      if (roleError) {
        console.error(`❌ Failed to create role ${roleData.role_name}:`, roleError);
        if (roleError.code === '42501') {
          console.log('🚨 RLS is blocking role creation - you MUST run the SQL script in Supabase dashboard');
        }
      } else {
        console.log(`✅ Role ${roleData.role_name} created successfully (ID: ${role.id})`);
        successCount++;
      }
    } catch (err) {
      console.error(`💥 Role ${roleData.role_name} creation failed:`, err.message);
    }
  }
  
  console.log(`\n📊 Successfully created ${successCount} out of ${roles.length} roles`);
  
  if (successCount === 0) {
    console.log('\n🚨 CRITICAL: Unable to create any roles with anon key!');
    console.log('🔧 YOU MUST USE ONE OF THESE SOLUTIONS:');
    console.log('');
    console.log('SOLUTION A: Run SQL Script in Supabase Dashboard (EASIEST)');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor (left sidebar)');
    console.log('4. Paste this SQL and click Run:');
    console.log('');
    console.log('INSERT INTO public.tenants (id, name, subdomain, status, subscription_plan, max_students, max_teachers, max_classes, contact_email) VALUES (\'b8f8b5f0-1234-4567-8901-123456789000\', \'Default School\', \'default\', \'active\', \'enterprise\', 1000, 100, 50, \'admin@school.com\') ON CONFLICT (id) DO NOTHING;');
    console.log('INSERT INTO public.roles (role_name, tenant_id) VALUES (\'Admin\', \'b8f8b5f0-1234-4567-8901-123456789000\'), (\'Teacher\', \'b8f8b5f0-1234-4567-8901-123456789000\'), (\'Parent\', \'b8f8b5f0-1234-4567-8901-123456789000\'), (\'Student\', \'b8f8b5f0-1234-4567-8901-123456789000\') ON CONFLICT (role_name) DO NOTHING;');
    console.log('');
    console.log('SOLUTION B: Get Service Role Key');
    console.log('1. Go to Supabase Dashboard > Settings > API');
    console.log('2. Copy the "service_role" key');
    console.log('3. Edit insert_roles_alternative.js and replace YOUR_SERVICE_ROLE_KEY_HERE');
    console.log('4. Run the script again');
    console.log('');
  }
  
  return successCount === roles.length;
}

// Run diagnosis and fix
async function main() {
  const diagnosisOk = await diagnoseIssue();
  
  if (!diagnosisOk) {
    console.log('\n❌ Diagnosis revealed critical issues that prevent automatic fixing.');
    console.log('💡 Please follow the solutions shown above.');
    return;
  }
  
  const fixSuccessful = await attemptDirectFix();
  
  if (fixSuccessful) {
    console.log('\n🎉 SUCCESS! All roles have been created.');
    console.log('✅ You should now be able to log in to your application.');
    
    // Final verification
    const { data: finalRoles } = await supabase.from('roles').select('*');
    console.log('\n📋 Final roles in database:');
    finalRoles.forEach(role => {
      console.log(`  - ${role.role_name} (ID: ${role.id})`);
    });
  } else {
    console.log('\n❌ Automatic fix failed. Please use the manual solutions provided above.');
  }
}

main().catch(console.error);
