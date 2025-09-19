const { supabase } = require('./src/utils/supabase');

async function checkTenant() {
  const tenantId = 'acb5595e-a709-4d24-940a-d370f3116171';
  
  console.log('🔍 Checking if tenant exists:', tenantId);
  
  try {
    // Check if tenant exists in the tenants table
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle();
    
    if (tenantError) {
      console.error('❌ Database error querying tenants table:', tenantError);
      return;
    }
    
    if (!tenant) {
      console.error('❌ TENANT NOT FOUND: No tenant record exists with ID:', tenantId);
      
      // Let's see what tenants do exist
      console.log('\n🔍 Checking what tenants exist in database...');
      const { data: allTenants, error: allTenantsError } = await supabase
        .from('tenants')
        .select('id, name, status')
        .order('created_at', { ascending: false });
      
      if (allTenantsError) {
        console.error('❌ Error fetching all tenants:', allTenantsError);
      } else {
        console.log('📋 Found tenants in database:');
        if (allTenants && allTenants.length > 0) {
          allTenants.forEach((t, index) => {
            console.log(`   ${index + 1}. ${t.name} (${t.id}) - Status: ${t.status}`);
          });
        } else {
          console.log('   ⚠️ No tenants found in database');
        }
      }
      
      return;
    }
    
    console.log('✅ TENANT FOUND:', {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      created_at: tenant.created_at
    });
    
    // Check if tenant is active
    if (tenant.status !== 'active') {
      console.error('❌ TENANT NOT ACTIVE: Tenant status is:', tenant.status);
    } else {
      console.log('✅ Tenant is active and should work');
    }
    
    // Also check if the current user is associated with this tenant
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('ℹ️ No authenticated user found');
      return;
    }
    
    console.log('\n👤 Checking current user tenant association...');
    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('id, email, tenant_id, full_name')
      .eq('email', user.email)
      .maybeSingle();
    
    if (userError) {
      console.error('❌ Error fetching user record:', userError);
    } else if (!userRecord) {
      console.error('❌ No user record found for email:', user.email);
    } else {
      console.log('👤 User record found:', {
        id: userRecord.id,
        email: userRecord.email,
        tenant_id: userRecord.tenant_id,
        full_name: userRecord.full_name
      });
      
      if (userRecord.tenant_id === tenantId) {
        console.log('✅ User is correctly associated with the tenant');
      } else {
        console.error('❌ TENANT MISMATCH:');
        console.error('   User tenant_id:', userRecord.tenant_id);
        console.error('   Expected tenant_id:', tenantId);
        console.error('   This is why validation fails!');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkTenant().then(() => {
  console.log('\n✅ Tenant check completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script error:', error);
  process.exit(1);
});