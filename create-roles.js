const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createDefaultRoles() {
  try {
    console.log('🔧 Creating default roles...');
    
    const defaultRoles = [
      { id: 1, role_name: 'Admin' },
      { id: 2, role_name: 'Teacher' },
      { id: 3, role_name: 'Parent' },
      { id: 4, role_name: 'Student' }
    ];
    
    for (const role of defaultRoles) {
      console.log(`Creating role: ${role.role_name} (ID: ${role.id})`);
      
      const { data, error } = await supabase
        .from('roles')
        .upsert(role, { onConflict: 'id' })
        .select();
      
      if (error) {
        console.log(`❌ Error creating role ${role.role_name}:`, error);
      } else {
        console.log(`✅ Successfully created/updated role: ${role.role_name}`);
      }
    }
    
    // Verify roles were created
    console.log('\n🔍 Verifying created roles...');
    const { data: allRoles, error: verifyError } = await supabase
      .from('roles')
      .select('*')
      .order('id');
    
    if (verifyError) {
      console.log('❌ Error verifying roles:', verifyError);
    } else {
      console.log('✅ Roles in database:');
      allRoles.forEach(role => {
        console.log(`   - ID: ${role.id}, Name: ${role.role_name}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error creating default roles:', error);
  }
}

// Run the script
createDefaultRoles().then(() => {
  console.log('\n🏁 Roles creation completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
