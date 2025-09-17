// Web Logout Fix - Diagnostic and Solution Tool
// This script helps diagnose and fix logout issues in the web version

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

async function testLogoutFunctionality() {
  console.log('🔍 WEB LOGOUT DIAGNOSTIC TEST\n');
  console.log('='.repeat(50));
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log('1. 🧪 Testing Supabase Auth Client...');
    
    // Check if client is working
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('   Current session exists:', !!session);
    console.log('   Session error:', sessionError?.message || 'None');
    
    if (session) {
      console.log('   User email:', session.user.email);
      console.log('   Session expires:', new Date(session.expires_at * 1000));
      console.log('   Session is expired:', new Date(session.expires_at * 1000) < new Date());
    }
    
    console.log('\n2. 🚪 Testing signOut method...');
    
    // Test different signOut approaches
    const methods = [
      {
        name: 'Direct signOut',
        test: () => supabase.auth.signOut()
      },
      {
        name: 'signOut with scope global',
        test: () => supabase.auth.signOut({ scope: 'global' })
      },
      {
        name: 'signOut with scope local',
        test: () => supabase.auth.signOut({ scope: 'local' })
      }
    ];
    
    for (const method of methods) {
      console.log(`\n   Testing: ${method.name}`);
      
      try {
        const startTime = Date.now();
        const { error } = await Promise.race([
          method.test(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout after 5 seconds')), 5000)
          )
        ]);
        
        const duration = Date.now() - startTime;
        console.log(`   ✅ ${method.name}: Success in ${duration}ms`);
        if (error) {
          console.log(`   ⚠️ Error: ${error.message}`);
        }
      } catch (testError) {
        console.log(`   ❌ ${method.name}: Failed - ${testError.message}`);
      }
    }
    
    console.log('\n3. 🌐 Testing Web Storage Clearing...');
    
    // This part would run in browser context
    console.log('   Note: This section requires browser environment');
    console.log('   In browser console, run: localStorage.clear(); sessionStorage.clear();');
    
    console.log('\n4. 📊 DIAGNOSIS SUMMARY');
    console.log('='.repeat(50));
    
    if (!session) {
      console.log('✅ No active session found - logout should work normally');
    } else {
      console.log('⚠️  Active session detected - logout may be needed');
      console.log('   Recommendation: Clear browser storage manually');
    }
    
    console.log('\n💡 SOLUTIONS:');
    console.log('='.repeat(50));
    
    console.log('\n🔧 SOLUTION 1: Clear Browser Data');
    console.log('   1. Open Developer Tools (F12)');
    console.log('   2. Go to Application tab');
    console.log('   3. Clear all Local Storage and Session Storage');
    console.log('   4. Clear all cookies for your domain');
    console.log('   5. Refresh the page');
    
    console.log('\n🔧 SOLUTION 2: Use Incognito Mode');
    console.log('   1. Open an incognito/private window');
    console.log('   2. Navigate to your app');
    console.log('   3. Login and test logout functionality');
    
    console.log('\n🔧 SOLUTION 3: Force Logout Script');
    console.log('   1. Open browser console on your app');
    console.log('   2. Run the following code:');
    console.log(`
   // Force clear all auth data
   localStorage.clear();
   sessionStorage.clear();
   document.cookie.split(";").forEach(function(c) { 
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
   });
   window.location.reload();`);
   
    console.log('\n🔧 SOLUTION 4: Update AuthContext timeout');
    console.log('   In your AuthContext.js, change the timeout from 3000 to 10000ms');
    console.log('   This gives more time for logout to complete on slow connections');
    
  } catch (error) {
    console.error('❌ Diagnostic test failed:', error);
  }
}

// Enhanced Web logout function that can be used in your app
const enhancedWebLogout = `
// Enhanced Web Logout Function
// Add this to your ProfileScreen.js or create a separate logout utility

const enhancedWebLogout = async (supabaseClient) => {
  console.log('🚪 Starting enhanced web logout...');
  
  const MAX_ATTEMPTS = 3;
  let attempt = 1;
  
  while (attempt <= MAX_ATTEMPTS) {
    try {
      console.log(\`Logout attempt \${attempt}/\${MAX_ATTEMPTS}\`);
      
      // Step 1: Sign out with longer timeout
      const signOutPromise = supabaseClient.auth.signOut({ scope: 'global' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logout timeout')), 8000)
      );
      
      const { error } = await Promise.race([signOutPromise, timeoutPromise]);
      
      if (error) {
        console.warn(\`Logout attempt \${attempt} failed:\`, error.message);
        if (attempt === MAX_ATTEMPTS) {
          throw error;
        }
        attempt++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
        continue;
      }
      
      console.log('✅ Supabase signOut successful');
      break;
      
    } catch (error) {
      console.error(\`Logout attempt \${attempt} error:\`, error.message);
      
      if (attempt === MAX_ATTEMPTS) {
        console.log('⚠️ All logout attempts failed, forcing local cleanup');
        // Force local cleanup even if server logout fails
        break;
      }
      
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Step 2: Force clear local storage (always do this)
  try {
    console.log('🧹 Clearing local authentication data...');
    
    const authKeys = [
      'sb-dmagnsbdjsnzsddxqrwd-auth-token',
      'supabase.auth.token',
      'auth-token',
      'session',
      'user',
      'access_token',
      'refresh_token'
    ];
    
    authKeys.forEach(key => {
      try {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      } catch (e) {
        console.warn(\`Could not clear \${key}\`);
      }
    });
    
    // Clear auth-related cookies
    document.cookie.split(";").forEach(function(c) {
      const name = c.split("=")[0].trim();
      if (name.includes('auth') || name.includes('session') || name.includes('token')) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname;
      }
    });
    
    console.log('✅ Local cleanup completed');
    
  } catch (cleanupError) {
    console.error('❌ Local cleanup failed:', cleanupError);
  }
  
  // Step 3: Navigate or reload
  try {
    console.log('🧭 Redirecting to login...');
    
    // Try navigation service first
    if (window.navigationService && window.navigationService.reset) {
      window.navigationService.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } else {
      // Fallback to location change
      window.location.href = '/';
    }
    
  } catch (navError) {
    console.error('❌ Navigation failed:', navError);
    // Last resort: reload page
    window.location.reload();
  }
};

// Usage in your ProfileScreen:
// await enhancedWebLogout(supabase);
`;

console.log(enhancedWebLogout);

if (require.main === module) {
  testLogoutFunctionality().then(() => {
    console.log('\n🏁 Web logout diagnostic complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Diagnostic failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testLogoutFunctionality };
