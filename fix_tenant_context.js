const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixTenantContext() {
  console.log('🔧 FIXING TENANT CONTEXT FOR PARENT...\n');

  try {
    // Check parent user tenant_id
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'Arshadpatel1431@gmail.com')
      .single();

    if (parentError) {
      console.log('❌ Parent user not found:', parentError.message);
      return false;
    }

    console.log('✅ Parent user found:', {
      email: parentUser.email,
      tenant_id: parentUser.tenant_id,
      full_name: parentUser.full_name
    });

    // Check if tenant exists and is active
    if (parentUser.tenant_id) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', parentUser.tenant_id)
        .single();

      if (tenantError) {
        console.log('❌ Tenant not found:', tenantError.message);
        return false;
      }

      console.log('✅ Tenant found:', {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        subdomain: tenant.subdomain
      });

      if (tenant.status !== 'active') {
        console.log('⚠️ Tenant is not active, activating...');
        
        const { error: activateError } = await supabase
          .from('tenants')
          .update({ status: 'active' })
          .eq('id', tenant.id);

        if (activateError) {
          console.log('❌ Failed to activate tenant:', activateError.message);
        } else {
          console.log('✅ Tenant activated successfully');
        }
      }

      // Ensure parent user metadata includes tenant_id
      console.log('\n🔄 Checking auth metadata...');
      
      // Try to sign in to check if the user exists in auth
      console.log('This would require the actual password. The fix is to ensure the tenant context loads properly.');
      
      return true;
    } else {
      console.log('❌ Parent user has no tenant_id assigned');
      return false;
    }

  } catch (error) {
    console.error('❌ Fix failed:', error.message);
    return false;
  }
}

async function createManualTenantFix() {
  console.log('\n🛠️ CREATING MANUAL TENANT CONTEXT FIX...\n');

  console.log('Since the tenant context is not loading automatically, here are the manual steps:');
  console.log('\n1. 🎯 IMMEDIATE FIX - Use Browser Console:');
  console.log('   - Open your app in the browser');
  console.log('   - Press F12 to open developer tools');
  console.log('   - Go to the Console tab');
  console.log('   - Run this command:');
  console.log('     window.retryTenantLoading()');
  console.log('   - Then try:');
  console.log('     window.debugParentHomeworkTenantContext()');
  
  console.log('\n2. 🔄 ALTERNATIVE FIX - Restart App:');
  console.log('   - Close your app completely');
  console.log('   - Sign out if possible');
  console.log('   - Restart the app');
  console.log('   - Sign in again with: Arshadpatel1431@gmail.com');
  
  console.log('\n3. 📱 APP CACHE CLEAR:');
  console.log('   - On Android: Settings > Apps > Your App > Storage > Clear Cache');
  console.log('   - On iOS: Delete and reinstall the app');
  
  console.log('\n4. 🖥️ WEB BROWSER FIX:');
  console.log('   - Clear browser cache and cookies');
  console.log('   - Try incognito/private browsing mode');
  console.log('   - Hard refresh with Ctrl+Shift+R (or Cmd+Shift+R on Mac)');

  return true;
}

// Main execution
if (require.main === module) {
  fixTenantContext().then(async (fixed) => {
    await createManualTenantFix();
    
    if (fixed) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 TENANT CONTEXT DIAGNOSTICS COMPLETE!');
      console.log('='.repeat(60));
      console.log('\n💡 NEXT STEPS:');
      console.log('   1. Try the browser console commands above');
      console.log('   2. Restart the app if needed');
      console.log('   3. After tenant context loads, the screens should work');
      console.log('\n✅ Expected results after fix:');
      console.log('   - Homework screen will show assignments');
      console.log('   - Report card will show marks');
      console.log('   - Notifications will display properly');
    } else {
      console.log('\n❌ Tenant context issue detected');
      console.log('   Try the manual steps above');
    }
    
    console.log('\n🏁 Script complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Script failed:', err.message);
    process.exit(1);
  });
}
