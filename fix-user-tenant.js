const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create simple supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixUserTenant() {
  console.log('🔧 Fixing user tenant assignment...');
  
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ No authenticated user found. Please log in to your app first.');
      return;
    }
    
    console.log('👤 Current user email:', user.email);
    
    // Get available tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError);
      return;
    }
    
    if (!tenants || tenants.length === 0) {
      console.error('❌ No active tenants found in database');
      return;
    }
    
    console.log('\\n📋 Available active tenants:');
    tenants.forEach((t, index) => {
      console.log(`   ${index + 1}. ${t.name} (${t.id})`);
    });
    
    // For this fix, let's use "Azher Patel School" as it seems to be the main one
    const targetTenant = tenants.find(t => t.name.includes('Azher Patel')) || tenants[0];
    
    console.log(`\\n🎯 Will assign user to: ${targetTenant.name} (${targetTenant.id})`);
    
    // Update user's tenant_id
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ tenant_id: targetTenant.id })
      .eq('email', user.email)
      .select();
    
    if (updateError) {
      console.error('❌ Error updating user tenant:', updateError);
      return;
    }
    
    if (!updatedUser || updatedUser.length === 0) {
      console.error('❌ No user record was updated. User might not exist in users table.');
      return;
    }
    
    console.log('✅ SUCCESS! User tenant updated:');
    console.log('   Email:', updatedUser[0].email);
    console.log('   New Tenant ID:', updatedUser[0].tenant_id);
    console.log('   Tenant Name:', targetTenant.name);
    
    console.log('\\n🎉 You should now be able to add classes successfully!');
    console.log('💡 Please refresh your browser and try adding a class again.');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

fixUserTenant().then(() => {
  console.log('\\n✅ Fix completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script error:', error);
  process.exit(1);
});