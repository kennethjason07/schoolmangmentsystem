const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRoles() {
  console.log('🔍 Checking roles table...');
  
  const { data: roles, error } = await supabase
    .from('roles')
    .select('*')
    .order('id');
    
  if (error) {
    console.error('❌ Error fetching roles:', error);
    return;
  }
  
  console.log(`📊 Roles found: ${roles.length}`);
  
  if (roles.length === 0) {
    console.log('⚠️ No roles found in the database!');
    console.log('💡 Creating default roles...');
    await createDefaultRoles();
  } else {
    roles.forEach(role => {
      console.log(`  - ${role.role_name} (ID: ${role.id}, Tenant: ${role.tenant_id || 'None'})`);
    });
  }
}

async function createDefaultRoles() {
  const defaultTenantId = 'b8f8b5f0-1234-4567-8901-123456789000';
  
  const defaultRoles = [
    { role_name: 'Admin', tenant_id: defaultTenantId },
    { role_name: 'Teacher', tenant_id: defaultTenantId },
    { role_name: 'Parent', tenant_id: defaultTenantId },
    { role_name: 'Student', tenant_id: defaultTenantId }
  ];
  
  for (let role of defaultRoles) {
    const { data, error } = await supabase
      .from('roles')
      .insert(role)
      .select()
      .single();
      
    if (error) {
      console.error(`❌ Error creating role ${role.role_name}:`, error);
    } else {
      console.log(`✅ Created role: ${role.role_name} (ID: ${data.id})`);
    }
  }
}

checkRoles().catch(console.error);
