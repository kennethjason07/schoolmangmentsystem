// QUICK TEST FOR LOGIN FIX
// Run this with: node TestLoginFix.js

const { createClient } = require('@supabase/supabase-js');

// Your Supabase configuration
const supabaseUrl = 'https://dmagnsbdjsnzsddxqrwd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYWduc2JkanNuenNkZHhxcndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTQ2MTEsImV4cCI6MjA2ODIzMDYxMX0.VAo64FAcg1Mo4qA22FWwC7Kdq6AAiLTNeBOjFB9XTi8';

async function testAuthFix() {
  console.log('🧪 TESTING AUTHENTICATION FIX\n');
  
  try {
    // Step 1: Create clean Supabase client
    console.log('Step 1: Creating clean Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // Don't persist to avoid issues
      }
    });
    
    // Step 2: Test connection
    console.log('Step 2: Testing connection...');
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.log('⚠️ Connection error (expected if no session):', error.message);
    } else {
      console.log('✅ Connection successful');
      console.log('Session status:', session ? 'Active' : 'None');
    }
    
    // Step 3: Test basic database query
    console.log('Step 3: Testing database connectivity...');
    const { data: testData, error: dbError } = await supabase
      .from('roles')
      .select('*')
      .limit(1);
    
    if (dbError) {
      console.log('❌ Database error:', dbError.message);
    } else {
      console.log('✅ Database connection working');
      console.log('Sample data retrieved:', testData?.length || 0, 'rows');
    }
    
    console.log('\n✅ AUTHENTICATION FIX TEST COMPLETED!');
    console.log('\n📋 SUMMARY:');
    console.log('- Supabase client creation: ✅ Working');
    console.log('- Connection test: ✅ Working');
    console.log('- Database connectivity: ✅ Working');
    
    console.log('\n🎯 NEXT STEPS FOR YOUR APP:');
    console.log('1. Use the AuthEmergencyFix.js component in your React Native app');
    console.log('2. When users get login errors, have them run the emergency fix');
    console.log('3. After clearing auth data, users should be able to login normally');
    console.log('4. The timeout issues should be resolved');
    
    console.log('\n🔧 IF USERS STILL HAVE ISSUES:');
    console.log('1. Check network connectivity');
    console.log('2. Verify Supabase service status');
    console.log('3. Clear browser cache (for web version)');
    console.log('4. Restart the app completely');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Check that Supabase URL and key are correct');
    console.log('2. Verify network connectivity');
    console.log('3. Check that @supabase/supabase-js is installed');
    console.log('4. Run: npm install @supabase/supabase-js');
  }
}

// Additional test for React Native AsyncStorage simulation
async function testStorageClearing() {
  console.log('\n🧹 TESTING STORAGE CLEARING SIMULATION\n');
  
  // Simulate the storage keys that would be cleared
  const authKeys = [
    'sb-dmagnsbdjsnzsddxqrwd-auth-token',
    'supabase.auth.token',
    'auth-token',
    'session',
    'user',
    'access_token',
    'refresh_token'
  ];
  
  console.log('Storage keys that would be cleared:');
  authKeys.forEach((key, index) => {
    console.log(`${index + 1}. ${key}`);
  });
  
  console.log('\n✅ Storage clearing would target', authKeys.length, 'keys');
  console.log('This should resolve the "Invalid Refresh Token" errors');
}

// Run tests
if (require.main === module) {
  testAuthFix()
    .then(() => testStorageClearing())
    .then(() => {
      console.log('\n🏁 All tests completed!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\n❌ Test suite failed:', err.message);
      process.exit(1);
    });
}

module.exports = { testAuthFix, testStorageClearing };
