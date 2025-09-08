// 🔍 BROWSER CONSOLE TENANT DEBUG SCRIPT
// Copy and paste this into your browser console when on the Stationary Management page

console.log('🔍 TENANT DEBUG SCRIPT STARTING...');
console.log('=' .repeat(60));

// Function to check tenant context and data
async function debugTenantData() {
  try {
    // Check if we're in the React Native web environment
    if (typeof window !== 'undefined' && window.location) {
      console.log('🌐 Environment: Web Browser');
      console.log('📍 Current URL:', window.location.href);
    }
    
    // Try to access the global app state (if available)
    console.log('\n📋 STEP 1: Checking Global State');
    console.log('-'.repeat(40));
    
    // Look for common global variables that might contain tenant info
    const globalVars = ['_expo', 'ExpoModules', '__EXPO_ENV__'];
    globalVars.forEach(varName => {
      if (typeof window !== 'undefined' && window[varName]) {
        console.log(`✅ Found global: ${varName}`, typeof window[varName]);
      } else {
        console.log(`❌ Global not found: ${varName}`);
      }
    });
    
    // Check AsyncStorage (React Native web)
    if (typeof window !== 'undefined' && window.localStorage) {
      console.log('\n📋 STEP 2: Checking Local Storage');
      console.log('-'.repeat(40));
      
      const storageKeys = Object.keys(window.localStorage);
      console.log('🗃️ Local Storage Keys:', storageKeys);
      
      // Look for tenant-related keys
      const tenantKeys = storageKeys.filter(key => 
        key.toLowerCase().includes('tenant') || 
        key.toLowerCase().includes('user') ||
        key.toLowerCase().includes('auth')
      );
      
      if (tenantKeys.length > 0) {
        console.log('🏢 Tenant-related storage keys:');
        tenantKeys.forEach(key => {
          try {
            const value = window.localStorage.getItem(key);
            console.log(`   ${key}:`, value);
          } catch (e) {
            console.log(`   ${key}:`, 'Error reading value');
          }
        });
      } else {
        console.log('❌ No tenant-related keys found in localStorage');
      }
    }
    
    // Check if we can access Supabase client
    console.log('\n📋 STEP 3: Checking Supabase Access');
    console.log('-'.repeat(40));
    
    // Try to find Supabase in global scope
    if (typeof window !== 'undefined') {
      const possibleSupabase = [
        window.supabase,
        window.__supabase,
        window.expo?.supabase
      ];
      
      let foundSupabase = false;
      possibleSupabase.forEach((sb, index) => {
        if (sb) {
          console.log(`✅ Found Supabase client at index ${index}:`, typeof sb);
          foundSupabase = true;
        }
      });
      
      if (!foundSupabase) {
        console.log('❌ Supabase client not found in global scope');
        console.log('💡 This is normal for React Native apps - Supabase is likely in app context');
      }
    }
    
    console.log('\n📋 STEP 4: Instructions for Manual Testing');
    console.log('-'.repeat(40));
    console.log('1. Look at the Network tab in developer tools');
    console.log('2. Refresh the Stationary Management page');
    console.log('3. Look for API calls to Supabase (usually to supabase.co)');
    console.log('4. Check the query parameters or request body for tenant_id filtering');
    console.log('5. Look for calls like:');
    console.log('   - stationary_items?select=*&tenant_id=eq.SOME_ID');
    console.log('   - stationary_purchases?select=*&tenant_id=eq.SOME_ID');
    
    console.log('\n📋 STEP 5: Check Console Messages');
    console.log('-'.repeat(40));
    console.log('Look for debug messages in the console like:');
    console.log('   🏢 StationaryManagement - Tenant Debug: {...}');
    console.log('   🔍 Loading stationary items for tenant: ...');
    console.log('   📦 Loaded items: N items for tenant: ...');
    console.log('   📄 Loaded purchases: N purchases for tenant: ...');
    
  } catch (error) {
    console.error('❌ Debug script failed:', error);
  }
}

// Run the debug function
debugTenantData();

console.log('\n💡 WHAT TO DO NEXT:');
console.log('1. Copy the output from this console');
console.log('2. Navigate to Stationary Management');  
console.log('3. Look for the debug messages mentioned above');
console.log('4. Check the Network tab for API calls');
console.log('5. Share the tenant_id values you see');
