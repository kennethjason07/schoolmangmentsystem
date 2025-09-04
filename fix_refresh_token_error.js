const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

// Create a simple storage adapter for testing
const testStorageAdapter = {
  getItem: (key) => {
    try {
      const item = require('fs').readFileSync(`./temp_${key}.json`, 'utf8');
      return Promise.resolve(item);
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    require('fs').writeFileSync(`./temp_${key}.json`, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    try {
      require('fs').unlinkSync(`./temp_${key}.json`);
    } catch {}
    return Promise.resolve();
  }
};

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: testStorageAdapter,
    autoRefreshToken: true,
    persistSession: true
  }
});

async function diagnoseRefreshTokenIssue() {
  console.log('🔍 Diagnosing Refresh Token Issue...\n');

  // Step 1: Check current session
  console.log('Step 1: Checking current session...');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.log('❌ Session error:', sessionError.message);
    return;
  }

  console.log('Current session status:', sessionData.session ? 'Active' : 'None');
  
  if (sessionData.session) {
    console.log('✅ Session found:');
    console.log('  - User ID:', sessionData.session.user.id);
    console.log('  - Email:', sessionData.session.user.email);
    console.log('  - Access token expires:', new Date(sessionData.session.expires_at * 1000).toISOString());
    
    // Decode JWT to check tenant_id
    try {
      const payload = JSON.parse(Buffer.from(sessionData.session.access_token.split('.')[1], 'base64').toString());
      console.log('  - Tenant ID in JWT:', payload.tenant_id || '❌ MISSING');
      console.log('  - Role:', payload.role || 'No role');
    } catch (e) {
      console.log('  - Unable to decode JWT:', e.message);
    }
    
    // Try to refresh the session
    console.log('\nStep 2: Testing session refresh...');
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.log('❌ Refresh error:', refreshError.message);
      if (refreshError.message.includes('Invalid Refresh Token')) {
        console.log('\n💡 SOLUTION: The refresh token is invalid. This usually means:');
        console.log('   1. The session has expired');
        console.log('   2. The refresh token was already used');
        console.log('   3. The token was revoked');
        console.log('\n🔧 To fix this, you need to:');
        console.log('   1. Sign out the user completely');
        console.log('   2. Clear all stored authentication data');
        console.log('   3. Have the user sign in again');
        
        await cleanupAuthData();
      }
    } else {
      console.log('✅ Session refreshed successfully');
    }
  } else {
    console.log('ℹ️  No active session found');
  }

  // Step 3: Check storage
  console.log('\nStep 3: Checking stored authentication data...');
  await checkStoredAuthData();
}

async function cleanupAuthData() {
  console.log('\n🧹 Cleaning up authentication data...');
  
  try {
    // Sign out
    await supabase.auth.signOut();
    console.log('✅ Signed out successfully');
    
    // Clear storage
    const authKeys = ['sb-dmagnsbdjsnzsddxqrwd-auth-token', 'supabase.auth.token'];
    for (const key of authKeys) {
      try {
        await testStorageAdapter.removeItem(key);
        console.log(`✅ Cleared storage key: ${key}`);
      } catch (e) {
        console.log(`⚠️  Could not clear key ${key}:`, e.message);
      }
    }
    
    console.log('\n✅ Cleanup complete. User needs to sign in again.');
  } catch (error) {
    console.log('❌ Cleanup error:', error.message);
  }
}

async function checkStoredAuthData() {
  const possibleKeys = [
    'sb-dmagnsbdjsnzsddxqrwd-auth-token',
    'supabase.auth.token',
    'auth-token',
    'session'
  ];
  
  for (const key of possibleKeys) {
    try {
      const data = await testStorageAdapter.getItem(key);
      if (data) {
        console.log(`✅ Found data for key: ${key}`);
        try {
          const parsed = JSON.parse(data);
          if (parsed.refresh_token) {
            console.log('  - Contains refresh token');
          }
          if (parsed.access_token) {
            console.log('  - Contains access token');
          }
          if (parsed.expires_at) {
            const expiresAt = new Date(parsed.expires_at * 1000);
            const isExpired = expiresAt < new Date();
            console.log(`  - Expires: ${expiresAt.toISOString()} ${isExpired ? '(EXPIRED)' : '(Valid)'}`);
          }
        } catch (e) {
          console.log('  - Data is not JSON or corrupted');
        }
      }
    } catch (e) {
      // Key doesn't exist, that's fine
    }
  }
}

// Test function for sign in
async function testSignIn(email, password) {
  console.log('\n🔐 Testing sign in...');
  console.log(`Email: ${email}`);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.log('❌ Sign in error:', error.message);
    return false;
  }
  
  console.log('✅ Sign in successful');
  console.log('User ID:', data.user.id);
  console.log('Email:', data.user.email);
  return true;
}

// Main execution
async function main() {
  try {
    await diagnoseRefreshTokenIssue();
    
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY & RECOMMENDATIONS:');
    console.log('='.repeat(50));
    console.log('1. If you see "Invalid Refresh Token" error:');
    console.log('   - Clear all authentication data');
    console.log('   - Sign out completely');
    console.log('   - Have users sign in again');
    console.log('');
    console.log('2. For your React Native app:');
    console.log('   - Clear AsyncStorage auth data');
    console.log('   - Clear web localStorage auth data');
    console.log('   - Reset the app state');
    console.log('');
    console.log('3. Prevention:');
    console.log('   - Handle token refresh errors gracefully');
    console.log('   - Implement automatic sign-out on refresh failure');
    console.log('   - Add proper error handling in auth flow');
    
  } catch (error) {
    console.log('❌ Diagnostic failed:', error.message);
  }
}

// Run the diagnostic
if (require.main === module) {
  main().then(() => {
    console.log('\n🏁 Diagnostic complete');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  diagnoseRefreshTokenIssue,
  cleanupAuthData,
  testSignIn
};
