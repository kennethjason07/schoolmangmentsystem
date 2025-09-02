// Script to check and create roles in the database
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixRoles() {
  console.log('🔧 Checking and Fixing Roles');
  console.log('============================');

  try {
    // 1. Check current roles
    console.log('\n1. CHECKING CURRENT ROLES:');
    const { data: currentRoles, error: rolesError } = await supabase
      .from('roles')
      .select('*');

    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError);
      return;
    }

    console.log(`📊 Found ${currentRoles?.length || 0} existing roles`);
    if (currentRoles && currentRoles.length > 0) {
      currentRoles.forEach(role => {
        console.log(`  - ${role.role_name} (ID: ${role.id})`);
      });
    }

    // 2. Create missing roles
    const requiredRoles = ['admin', 'teacher', 'student', 'parent'];
    const existingRoleNames = currentRoles ? currentRoles.map(r => r.role_name.toLowerCase()) : [];
    
    console.log('\n2. CREATING MISSING ROLES:');
    
    for (const roleName of requiredRoles) {
      if (!existingRoleNames.includes(roleName.toLowerCase())) {
        console.log(`Creating role: ${roleName}`);
        
        const { data: newRole, error: createError } = await supabase
          .from('roles')
          .insert({ role_name: roleName })
          .select()
          .single();
        
        if (createError) {
          console.error(`❌ Error creating role ${roleName}:`, createError);
        } else {
          console.log(`✅ Created role: ${roleName} (ID: ${newRole.id})`);
        }
      } else {
        console.log(`✅ Role ${roleName} already exists`);
      }
    }

    // 3. Display final roles
    console.log('\n3. FINAL ROLES LIST:');
    const { data: finalRoles, error: finalError } = await supabase
      .from('roles')
      .select('*')
      .order('id');

    if (finalError) {
      console.error('❌ Error fetching final roles:', finalError);
    } else {
      console.log(`📊 Total roles: ${finalRoles?.length || 0}`);
      if (finalRoles && finalRoles.length > 0) {
        finalRoles.forEach(role => {
          console.log(`  - ${role.role_name} (ID: ${role.id})`);
        });

        // 4. Show how to use these role IDs
        console.log('\n4. USAGE INFORMATION:');
        console.log('Use these role IDs in your user creation:');
        finalRoles.forEach(role => {
          console.log(`  ${role.role_name.toUpperCase()}_ROLE_ID = ${role.id}`);
        });
      }
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the script
fixRoles().then(() => {
  console.log('\n✅ Roles check/creation completed');
}).catch(error => {
  console.error('💥 Script failed:', error);
});
