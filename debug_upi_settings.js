// Debug UPI Settings - Standalone script to check UPI settings in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxsbxfjagiwjmjfxbuzc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4c2J4ZmphZ2l3am1qZnhidXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA2MTc5ODEsImV4cCI6MjA0NjE5Mzk4MX0.Hir0yPLI5kxRIjgnZK1UXVNB_-7EDN3Z_eHJN2OvjvE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUPISettings() {
  console.log('🔍 DEBUG: Starting UPI settings investigation...');
  
  try {
    // 1. Check all UPI settings regardless of tenant
    console.log('\n📊 Step 1: Fetching ALL UPI settings...');
    const { data: allSettings, error: allError } = await supabase
      .from('school_upi_settings')
      .select('*')
      .order('created_at', { ascending: false });
    
    console.log('All UPI Settings Result:', { data: allSettings, error: allError });
    
    if (allSettings && allSettings.length > 0) {
      console.log(`Found ${allSettings.length} UPI settings:`);
      allSettings.forEach((setting, index) => {
        console.log(`  ${index + 1}. ID: ${setting.id}`);
        console.log(`     UPI ID: ${setting.upi_id}`);
        console.log(`     Name: ${setting.upi_name}`);
        console.log(`     Tenant ID: ${setting.tenant_id}`);
        console.log(`     Is Primary: ${setting.is_primary}`);
        console.log(`     Is Active: ${setting.is_active}`);
        console.log(`     Created: ${setting.created_at}`);
        console.log('');
      });
    } else {
      console.log('❌ No UPI settings found in database!');
    }

    // 2. Check tenants
    console.log('\n📊 Step 2: Fetching all tenants...');
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, status')
      .order('created_at', { ascending: false });
    
    console.log('Tenants Result:', { data: tenants, error: tenantsError });
    
    if (tenants && tenants.length > 0) {
      console.log(`Found ${tenants.length} tenants:`);
      tenants.forEach((tenant, index) => {
        console.log(`  ${index + 1}. ID: ${tenant.id}`);
        console.log(`     Name: ${tenant.name}`);
        console.log(`     Status: ${tenant.status}`);
        console.log('');
      });

      // 3. For each tenant, try to get UPI settings
      console.log('\n📊 Step 3: Testing UPI settings retrieval for each tenant...');
      for (const tenant of tenants) {
        console.log(`\n🏢 Testing tenant: ${tenant.name} (${tenant.id})`);
        
        const { data: tenantUPI, error: tenantUPIError } = await supabase
          .from('school_upi_settings')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('is_active', true)
          .order('is_primary', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);
        
        console.log(`  Query Result:`, { data: tenantUPI, error: tenantUPIError });
        
        if (tenantUPI && tenantUPI.length > 0) {
          const setting = tenantUPI[0];
          console.log(`  ✅ Found UPI setting: ${setting.upi_id} (Primary: ${setting.is_primary})`);
        } else if (tenantUPIError) {
          console.log(`  ❌ Error: ${tenantUPIError.message} (Code: ${tenantUPIError.code})`);
        } else {
          console.log(`  ⚠️ No active UPI settings for this tenant`);
        }
      }
    }

    // 4. Test the exact query from UPIService
    console.log('\n📊 Step 4: Testing the exact UPIService query...');
    if (tenants && tenants.length > 0) {
      const testTenantId = tenants[0].id; // Use first tenant
      console.log(`Using tenant ID: ${testTenantId}`);
      
      const { data: exactQuery, error: exactError } = await supabase
        .from('school_upi_settings')
        .select('*')
        .eq('tenant_id', testTenantId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      console.log('Exact UPIService query result:', { data: exactQuery, error: exactError });
      
      if (exactError && exactError.code === 'PGRST116') {
        console.log('  ⚠️ This is the "No rows found" error that triggers fallback');
      }
    }

  } catch (error) {
    console.error('❌ Fatal error during debug:', error);
  }
}

// Run the debug
debugUPISettings().then(() => {
  console.log('\n✅ UPI settings debug completed!');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
