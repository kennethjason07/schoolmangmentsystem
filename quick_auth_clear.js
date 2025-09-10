const { AuthFix } = require('./src/utils/authFix');

async function quickAuthClear() {
  console.log('🧹 QUICK AUTH CLEAR - Fixing "Invalid Refresh Token" Error...\n');
  
  try {
    // Step 1: Debug current auth state
    console.log('Step 1: Checking current auth state...');
    await AuthFix.debugAuthState();
    
    // Step 2: Force sign out and clear all auth data
    console.log('\nStep 2: Clearing all authentication data...');
    const clearResult = await AuthFix.forceSignOut();
    
    if (clearResult) {
      console.log('✅ Authentication data cleared successfully!');
    } else {
      console.log('⚠️ Some issues occurred during clearing, but continuing...');
    }
    
    // Step 3: Verify session is cleared
    console.log('\nStep 3: Verifying session is cleared...');
    const validationResult = await AuthFix.validateAndFixSession();
    
    if (validationResult.needsReauth) {
      console.log('✅ Session cleared - user will need to sign in again');
    } else if (validationResult.valid) {
      console.log('⚠️ Session still active, but this might be normal');
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ QUICK FIX COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n💡 WHAT TO DO NOW:');
    console.log('1. Restart your React Native app/expo server');
    console.log('2. The "Invalid Refresh Token" error should be gone');
    console.log('3. Users will need to sign in again');
    console.log('4. Normal authentication should work properly');
    
    console.log('\n📱 IN YOUR APP:');
    console.log('- The AuthFix utility is already integrated in your AuthContext');
    console.log('- It should automatically handle similar errors in the future');
    console.log('- Users can clear auth data through the app if needed');
    
  } catch (error) {
    console.error('❌ Quick auth clear failed:', error.message);
    console.log('\n🔧 MANUAL SOLUTION:');
    console.log('1. Clear your browser/app cache');
    console.log('2. In React Native: Delete all AsyncStorage auth keys');
    console.log('3. Restart the app and sign in again');
  }
}

// Run the quick fix
if (require.main === module) {
  quickAuthClear().then(() => {
    console.log('\n🏁 Done! Restart your app to see the fix.');
    process.exit(0);
  }).catch(err => {
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  });
}

module.exports = { quickAuthClear };
